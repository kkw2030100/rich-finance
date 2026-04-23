import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 시총 구간 분류
function getTier(mcap: number): string {
  if (mcap >= 50000) return '초대형주';
  if (mcap >= 10000) return '대형주';
  if (mcap >= 3000) return '중형주';
  return '소형주';
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const params = req.nextUrl.searchParams;
    const market = params.get('market') || 'all';
    const sort = params.get('sort') || 'undervalue';
    const tier = params.get('tier') || 'all';
    const limit = parseInt(params.get('limit') || '50');

    // scores 테이블이 비어있으면 간이 스코어링, 있으면 엔진 결과 사용
    const scoreCount = (db.prepare('SELECT count(*) as cnt FROM scores').get() as { cnt: number }).cnt;
    const useEngineScores = scoreCount > 0;

    // 전종목 + 최신 시세 + 재무
    const stocks = db.prepare(`
      SELECT
        s.code, s.name, s.market,
        dp.close AS price, dp.change_pct, dp.market_cap,
        dp.date AS price_date
      FROM stocks s
      JOIN daily_prices dp ON s.code = dp.code
      WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code)
        ${market !== 'all' ? 'AND s.market = ?' : ''}
      ORDER BY dp.market_cap DESC
    `).all(...(market !== 'all' ? [market] : [])) as Array<{
      code: string; name: string; market: string;
      price: number; change_pct: number; market_cap: number; price_date: string;
    }>;

    // 엔진 scores 맵
    const scoresMap: Record<string, {
      total_score: number; verdict: string; confidence: number;
      layer1_score: number; layer2_score: number; layer3_score: number; layer4_score: number;
      reasons: string; risks: string;
    }> = {};

    if (useEngineScores) {
      const today = (db.prepare('SELECT MAX(date) as d FROM scores').get() as { d: string }).d;
      const scoreRows = db.prepare(`
        SELECT code, total_score, verdict, confidence,
               layer1_score, layer2_score, layer3_score, layer4_score,
               reasons, risks
        FROM scores WHERE date = ? AND layer0_pass = 1
      `).all(today);
      for (const r of scoreRows as Array<typeof scoresMap[string] & { code: string }>) {
        scoresMap[r.code] = r;
      }
    }

    const results = stocks.map(stock => {
      const quarters = db.prepare(`
        SELECT * FROM financials
        WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT 8
      `).all(stock.code) as Array<{
        period: string; revenue: number; operating_profit: number; net_income: number;
        op_margin: number | null; roe: number | null; debt_ratio: number | null;
        per: number | null; pbr: number | null; is_estimate: number;
      }>;

      if (quarters.length < 2) return null;

      // TTM (4분기 있으면 TTM, 아니면 있는 만큼)
      const ttmCount = Math.min(quarters.length, 4);
      const recent = quarters.slice(0, ttmCount);
      const ttmRevenue = recent.reduce((s, q) => s + (q.revenue || 0), 0);
      const ttmNetIncome = recent.reduce((s, q) => s + (q.net_income || 0), 0);
      const ttmOp = recent.reduce((s, q) => s + (q.operating_profit || 0), 0);
      const perTtm = ttmNetIncome > 0 ? stock.market_cap / ttmNetIncome : null;

      // === 증감액 기반 괴리 계산 (BACKEND_HANDOFF v2) ===
      // 핵심: (순이익 증감액 × 적정PER) - 시총 증감액 = 괴리
      // 적정PER 10배 가정
      const FAIR_PER = 10;

      let niChange: number | null = null;     // 순이익 증감액 (억원)
      let opChange: number | null = null;     // 영업이익 증감액 (억원)
      let mcapChange: number | null = null;   // 시총 증감액 (억원)
      let niGapRatio: number | null = null;   // 시총 대비 괴리 비율 (%)
      let turnaround = false;                 // 흑자전환
      let deficitTurn = false;                // 적자전환

      // 시총 증감액 (1년 전 대비)
      const yearAgoPrice = db.prepare(`
        SELECT market_cap FROM daily_prices
        WHERE code = ? AND market_cap > 0
        ORDER BY date ASC LIMIT 1
      `).get(stock.code) as { market_cap: number } | undefined;

      if (yearAgoPrice && yearAgoPrice.market_cap > 0) {
        mcapChange = stock.market_cap - yearAgoPrice.market_cap;
      }

      // 순이익/영업이익 증감액 계산
      if (quarters.length >= 8) {
        // TTM 기반 (최근 4분기 vs 이전 4분기)
        const recentNi = quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0);
        const prevNi = quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);
        niChange = recentNi - prevNi;

        const recentOp = quarters.slice(0, 4).reduce((s, q) => s + (q.operating_profit || 0), 0);
        const prevOp = quarters.slice(4, 8).reduce((s, q) => s + (q.operating_profit || 0), 0);
        opChange = recentOp - prevOp;

        // 흑자전환/적자전환
        if (prevNi <= 0 && recentNi > 0) turnaround = true;
        if (prevNi > 0 && recentNi <= 0) deficitTurn = true;
      } else if (quarters.length >= 2) {
        // QoQ 폴백
        const curr = quarters[0];
        const prev = quarters[1];
        niChange = (curr.net_income || 0) - (prev.net_income || 0);
        opChange = (curr.operating_profit || 0) - (prev.operating_profit || 0);

        if ((prev.net_income || 0) <= 0 && (curr.net_income || 0) > 0) turnaround = true;
        if ((prev.net_income || 0) > 0 && (curr.net_income || 0) <= 0) deficitTurn = true;

        // 시총 증감도 같은 기간으로 폴백
        if (mcapChange === null) {
          const prevPeriod = prev.period.replace('(E)', '').trim();
          const [py, pm] = prevPeriod.split('.');
          if (py && pm) {
            const prevEnd = new Date(parseInt(py), parseInt(pm), 0).toISOString().slice(0, 10);
            const prevMcap = db.prepare(`
              SELECT market_cap FROM daily_prices
              WHERE code = ? AND market_cap > 0 AND date <= ?
              ORDER BY date DESC LIMIT 1
            `).get(stock.code, prevEnd) as { market_cap: number } | undefined;
            if (prevMcap && prevMcap.market_cap > 0) {
              mcapChange = stock.market_cap - prevMcap.market_cap;
            }
          }
        }
      }

      // 괴리 계산: (순이익 증감액 × 적정PER) - 시총 증감액
      let niGap: number | null = null;
      if (niChange !== null && mcapChange !== null) {
        niGap = (niChange * FAIR_PER) - mcapChange;
        if (stock.market_cap > 0) {
          niGapRatio = (niGap / stock.market_cap) * 100;
        }
      }

      // 하위 호환: niGrowth, mcapGrowth, undervalueIndex도 유지
      let niGrowth: number | null = null;
      let mcapGrowth: number | null = null;
      if (yearAgoPrice && yearAgoPrice.market_cap > 0) {
        mcapGrowth = ((stock.market_cap - yearAgoPrice.market_cap) / yearAgoPrice.market_cap) * 100;
      }
      if (quarters.length >= 8) {
        const recentNi = quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0);
        const prevNi = quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);
        if (prevNi !== 0) niGrowth = ((recentNi - prevNi) / Math.abs(prevNi)) * 100;
      }
      const undervalueIndex = niGapRatio;

      // 엔진 스코어 or 간이 스코어
      const eng = scoresMap[stock.code];
      let score: number;
      let verdict: string;
      let confidence: number;
      let reasons: string[] = [];
      let risks: string[] = [];

      if (eng) {
        score = eng.total_score;
        verdict = eng.verdict.toLowerCase().replace(/\s+/g, '_');
        confidence = eng.confidence;
        try { reasons = JSON.parse(eng.reasons || '[]'); } catch { reasons = []; }
        try { risks = JSON.parse(eng.risks || '[]'); } catch { risks = []; }
      } else {
        score = 50;
        if (perTtm !== null && perTtm > 0 && perTtm < 10) score += 10;
        if (quarters[0].roe && quarters[0].roe > 15) score += 8;
        if (undervalueIndex !== null && undervalueIndex > 50) score += 8;
        score = Math.min(score, 100);
        verdict = score >= 75 ? 'strong_buy' : score >= 60 ? 'buy' : score <= 25 ? 'strong_sell' : score <= 40 ? 'sell' : 'hold';
        confidence = 50;
      }

      const stockTier = getTier(stock.market_cap);

      return {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        price: stock.price,
        changePct: stock.change_pct,
        marketCap: stock.market_cap,
        tier: stockTier,
        priceDate: stock.price_date,
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        roe: quarters[0].roe,
        pbr: quarters[0].pbr,
        debtRatio: quarters[0].debt_ratio,
        opMargin: quarters[0].op_margin,
        // 증감액 기반 (v2)
        niChange,
        opChange,
        mcapChange,
        niGapRatio: niGapRatio ? Math.round(niGapRatio * 10) / 10 : null,
        turnaround,
        deficitTurn,
        // 하위 호환 (증감율 기반)
        niGrowth: niGrowth ? Math.round(niGrowth * 10) / 10 : null,
        mcapGrowth: mcapGrowth ? Math.round(mcapGrowth * 10) / 10 : null,
        undervalueIndex: undervalueIndex ? Math.round(undervalueIndex * 10) / 10 : null,
        ttmRevenue,
        ttmNetIncome,
        ttmOp,
        score,
        verdict,
        confidence,
        reasons,
        risks,
      };
    }).filter(Boolean);

    // Tier 필터
    let filtered = results;
    if (tier !== 'all') {
      filtered = results.filter(r => r && r.tier === tier);
    }

    // 구간 내 분포 기반 판정 (tier_verdict)
    if (tier !== 'all' && useEngineScores) {
      const sorted = [...filtered].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
      const n = sorted.length;
      for (let i = 0; i < n; i++) {
        const pct = i / n * 100;
        const item = sorted[i];
        if (!item) continue;
        if (pct <= 5) item.verdict = 'strong_buy';
        else if (pct <= 20) item.verdict = 'buy';
        else if (pct <= 80) item.verdict = 'hold';
        else if (pct <= 95) item.verdict = 'sell';
        else item.verdict = 'strong_sell';
      }
    }

    // Sort
    const sorted = filtered.sort((a, b) => {
      if (!a || !b) return 0;
      switch (sort) {
        case 'score': return b.score - a.score;
        case 'undervalue': return (b.undervalueIndex ?? -9999) - (a.undervalueIndex ?? -9999);
        case 'per': return (a.perTtm ?? 9999) - (b.perTtm ?? 9999);
        case 'marketCap': return b.marketCap - a.marketCap;
        default: return (b.undervalueIndex ?? -9999) - (a.undervalueIndex ?? -9999);
      }
    }).slice(0, limit);

    // Distribution
    const dist = { strong_buy: 0, buy: 0, hold: 0, sell: 0, strong_sell: 0 };
    filtered.forEach(r => { if (r) dist[r.verdict as keyof typeof dist]++; });

    // Tier counts
    const tierCounts = { '초대형주': 0, '대형주': 0, '중형주': 0, '소형주': 0 };
    results.forEach(r => { if (r) tierCounts[r.tier as keyof typeof tierCounts]++; });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalCount: filtered.length,
      distribution: dist,
      tierCounts,
      engineScores: useEngineScores,
      data: sorted,
    });
  } catch (error) {
    console.error('Scores API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
