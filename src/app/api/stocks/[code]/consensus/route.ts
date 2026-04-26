import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaConsensus } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

// 미국 종목 식별
const isUSTicker = (code: string) => /^[A-Z][A-Z\.\-]{0,5}$/.test(code);

// 네이버 미국 종목 컨센서스 (NASDAQ=.O, NYSE=.K 시도)
async function fetchUSConsensus(code: string) {
  const suffixes = ['.O', '.K', '.A', '.N'];
  for (const sfx of suffixes) {
    try {
      const r = await fetch(`https://api.stock.naver.com/stock/${code}${sfx}/integration`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 }, // 1시간 캐시
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.consensusInfo?.priceTargetMean) return j;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * GET /api/stocks/{code}/consensus
 *
 * 증권사 컨센서스: 투자의견, 목표주가, 개별 증권사 의견
 * 가중 평균: 3개월 이내 ×1.0, 3~6개월 ×0.5, 6개월+ 제외
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;

    // 미국 종목: 네이버 API 직접 호출 (한국 DB에 컨센서스 없음)
    if (isUSTicker(code)) {
      const naver = await fetchUSConsensus(code);
      if (!naver?.consensusInfo) {
        return NextResponse.json({ error: 'No US consensus' }, { status: 404 });
      }
      const c = naver.consensusInfo;
      // 현재가 — 같은 응답의 corporateOverview 또는 industryCompareInfo에서 가능, 없으면 별도 fetch
      let currentPrice = 0;
      try {
        const priceRes = await fetch(`https://api.stock.naver.com/stock/${code}${c.reutersCode.slice(-2)}/basic`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 },
        });
        if (priceRes.ok) {
          const pj = await priceRes.json();
          currentPrice = parseFloat(pj?.closePrice || pj?.tradePrice || '0');
        }
      } catch { /* ignore */ }

      const targetMean = parseFloat(c.priceTargetMean);
      const high = parseFloat(c.priceTargetHigh);
      const low = parseFloat(c.priceTargetLow);
      const recommMean = parseFloat(c.recommMean);
      const upside = currentPrice > 0 ? Math.round((targetMean - currentPrice) / currentPrice * 1000) / 10 : null;

      // recommMean (1~5) → 의견 텍스트
      const opinionText = recommMean >= 4.5 ? '적극매수'
        : recommMean >= 3.5 ? '매수'
        : recommMean >= 2.5 ? '중립'
        : recommMean >= 1.5 ? '매도'
        : '적극매도';

      return NextResponse.json({
        code,
        rating: recommMean,
        targetPrice: targetMean,
        targetPriceWeighted: targetMean,
        targetPriceHigh: high,
        targetPriceLow: low,
        consensusEps: null,
        consensusPer: null,
        analystCount: 1200, // 레피니티브 1200개사
        recentCount: 1200,
        currentPrice,
        upside,
        currency: c.currencyType?.code || 'USD',
        opinionText,
        createDate: c.createDate,
        analysts: [],
        disclaimer: '레피니티브 1200개사 컨센서스. 투자 판단의 책임은 본인에게 있습니다.',
      });
    }

    if (!isLocalDb()) {
      const data = await supaConsensus(code);
      if (!data) return NextResponse.json({ error: 'No consensus data' }, { status: 404 });
      return NextResponse.json(data);
    }

    const db = getDb();

    // 컨센서스 요약
    const consensus = db.prepare(`
      SELECT rating, target_price, consensus_eps, consensus_per, analyst_count
      FROM consensus WHERE code = ?
    `).get(code) as {
      rating: number; target_price: number; consensus_eps: number;
      consensus_per: number; analyst_count: number;
    } | undefined;

    if (!consensus) {
      return NextResponse.json({ error: 'No consensus data' }, { status: 404 });
    }

    // 개별 증권사 의견
    const analysts = db.prepare(`
      SELECT provider, date, target_price, prev_target_price, change_pct, opinion, prev_opinion
      FROM analyst_opinions WHERE code = ?
      ORDER BY date DESC
    `).all(code) as Array<{
      provider: string; date: string; target_price: number;
      prev_target_price: number; change_pct: number;
      opinion: string; prev_opinion: string;
    }>;

    // 현재가
    const price = db.prepare(`
      SELECT close, market_cap FROM daily_prices
      WHERE code = ? AND close > 0 ORDER BY date DESC LIMIT 1
    `).get(code) as { close: number; market_cap: number } | undefined;

    const currentPrice = price?.close || 0;

    // 가중 평균 목표가 계산
    // date 형식: "26/04/21" → 2026-04-21
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let weightedSum = 0;
    let weightTotal = 0;
    let recentCount = 0;

    const enrichedAnalysts = analysts.map(a => {
      // "26/04/21" → Date
      const parts = a.date?.split('/');
      let aDate: Date | null = null;
      let weight = 0;

      if (parts && parts.length === 3) {
        const year = 2000 + parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        aDate = new Date(year, month, day);

        if (aDate >= threeMonthsAgo) {
          weight = 1.0;
          recentCount++;
        } else if (aDate >= sixMonthsAgo) {
          weight = 0.5;
        }
        // 6개월+ → weight 0
      }

      if (weight > 0 && a.target_price > 0) {
        weightedSum += a.target_price * weight;
        weightTotal += weight;
      }

      return {
        provider: a.provider,
        date: a.date,
        targetPrice: a.target_price,
        prevTargetPrice: a.prev_target_price,
        changePct: a.change_pct,
        opinion: a.opinion,
        prevOpinion: a.prev_opinion,
        weight,
      };
    });

    const targetPriceWeighted = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : consensus.target_price;
    const upside = currentPrice > 0 ? Math.round((targetPriceWeighted - currentPrice) / currentPrice * 1000) / 10 : null;

    return NextResponse.json({
      code,
      rating: consensus.rating,
      targetPrice: consensus.target_price,
      targetPriceWeighted,
      consensusEps: consensus.consensus_eps,
      consensusPer: consensus.consensus_per,
      analystCount: consensus.analyst_count,
      recentCount,
      currentPrice,
      upside,
      analysts: enrichedAnalysts,
      disclaimer: '증권사 의견은 참고 자료이며 투자 판단의 책임은 본인에게 있습니다.',
    });
  } catch (error) {
    console.error('Consensus API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
