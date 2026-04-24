import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaConsensus } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

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
