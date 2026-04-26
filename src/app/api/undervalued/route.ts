import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaUndervalued } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

const FAIR_PER = 10;

/**
 * 저평가 종목 4가지 모드
 *
 * GET /api/undervalued?mode=total|ttm|gap|composite&limit=30&tier=초대형주&quadrant=저평가+고품질
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const mode = params.get('mode') || 'total';
    const limit = parseInt(params.get('limit') || '30');
    const tier = params.get('tier');

    if (!isLocalDb()) {
      const data = await supaUndervalued({ mode, limit, tier: tier || undefined });
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=3600',
        },
      });
    }

    const db = getDb();
    const market = params.get('market');
    const quadrant = params.get('quadrant');

    const stocks = db.prepare(`
      SELECT s.code, s.name, s.market,
        dp.close AS price, dp.market_cap, dp.change_pct
      FROM stocks s
      JOIN daily_prices dp ON s.code = dp.code
      WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code)
        AND dp.market_cap > 0
        ${market && market !== 'all' ? 'AND s.market = ?' : ''}
    `).all(...(market && market !== 'all' ? [market] : [])) as Array<{
      code: string; name: string; market: string;
      price: number; market_cap: number; change_pct: number;
    }>;

    // 엔진 스코어
    const scoreDate = (db.prepare('SELECT MAX(date) as d FROM scores').get() as { d: string | null })?.d;
    const scoresMap: Record<string, { total_score: number; verdict: string }> = {};
    if (scoreDate) {
      const rows = db.prepare('SELECT code, total_score, verdict FROM scores WHERE date = ? AND layer0_pass = 1').all(scoreDate);
      for (const r of rows as Array<{ code: string; total_score: number; verdict: string }>) {
        scoresMap[r.code] = r;
      }
    }

    const results = stocks.map(stock => {
      const quarters = db.prepare(`
        SELECT period, revenue, operating_profit, net_income, roe, pbr, debt_ratio, is_estimate
        FROM financials WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT 8
      `).all(stock.code) as Array<{
        period: string; revenue: number; operating_profit: number; net_income: number;
        roe: number | null; pbr: number | null; debt_ratio: number | null; is_estimate: number;
      }>;

      if (quarters.length < 2) return null;

      const ttmCount = Math.min(quarters.length, 4);
      const ttmNi = quarters.slice(0, ttmCount).reduce((s, q) => s + (q.net_income || 0), 0);
      const ttmOp = quarters.slice(0, ttmCount).reduce((s, q) => s + (q.operating_profit || 0), 0);
      const ttmRev = quarters.slice(0, ttmCount).reduce((s, q) => s + (q.revenue || 0), 0);

      const perTtm = ttmNi > 0 ? stock.market_cap / ttmNi : null;
      const porTtm = ttmOp > 0 ? stock.market_cap / ttmOp : null;
      const psrTtm = ttmRev > 0 ? stock.market_cap / ttmRev : null;

      // 증감액 괴리
      let niChange: number | null = null;
      let opChange: number | null = null;
      let mcapChange: number | null = null;
      let niGapRatio: number | null = null;
      let turnaround = false;
      let deficitTurn = false;

      const yearAgo = db.prepare(`
        SELECT market_cap FROM daily_prices WHERE code = ? AND market_cap > 0 ORDER BY date ASC LIMIT 1
      `).get(stock.code) as { market_cap: number } | undefined;

      if (yearAgo) mcapChange = stock.market_cap - yearAgo.market_cap;

      if (quarters.length >= 8) {
        const recentNi = quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0);
        const prevNi = quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);
        niChange = recentNi - prevNi;
        const recentOp = quarters.slice(0, 4).reduce((s, q) => s + (q.operating_profit || 0), 0);
        const prevOp = quarters.slice(4, 8).reduce((s, q) => s + (q.operating_profit || 0), 0);
        opChange = recentOp - prevOp;
        if (prevNi <= 0 && recentNi > 0) turnaround = true;
        if (prevNi > 0 && recentNi <= 0) deficitTurn = true;
      } else {
        niChange = (quarters[0].net_income || 0) - (quarters[1].net_income || 0);
        opChange = (quarters[0].operating_profit || 0) - (quarters[1].operating_profit || 0);
        if ((quarters[1].net_income || 0) <= 0 && (quarters[0].net_income || 0) > 0) turnaround = true;
        if ((quarters[1].net_income || 0) > 0 && (quarters[0].net_income || 0) <= 0) deficitTurn = true;
      }

      if (niChange !== null && mcapChange !== null && stock.market_cap > 0) {
        const niGap = (niChange * FAIR_PER) - mcapChange;
        niGapRatio = (niGap / stock.market_cap) * 100;
      }

      // 복합인덱스 (DART)
      const dart = db.prepare(`
        SELECT gpa, fcf, total_equity, total_liabilities
        FROM dart_financials WHERE code = ? ORDER BY year DESC LIMIT 1
      `).get(stock.code) as { gpa: number; fcf: number; total_equity: number; total_liabilities: number } | undefined;

      let uiQuadrant: string | null = null;
      let uiIndex: number | null = null;
      let uiValue: number | null = null;
      let uiQuality: number | null = null;
      if (dart) {
        const valueScore = (perTtm && perTtm > 0 && perTtm < 50) ? Math.max(0, 50 - perTtm) : 0;
        const qualityScore = (dart.gpa || 0) * 100 + ((dart.fcf || 0) > 0 ? 20 : 0);
        uiValue = Math.round(Math.min(valueScore * 2, 100));
        uiQuality = Math.round(Math.min(qualityScore, 100));
        uiIndex = Math.round(valueScore + qualityScore);
        const medV = 25, medQ = 30;
        if (valueScore >= medV && qualityScore >= medQ) uiQuadrant = '저평가+고품질';
        else if (valueScore >= medV) uiQuadrant = '저평가+저품질';
        else if (qualityScore >= medQ) uiQuadrant = '고평가+고품질';
        else uiQuadrant = '고평가+저품질';
      }

      const eng = scoresMap[stock.code];
      const stockTier = stock.market_cap >= 50000 ? '초대형주' : stock.market_cap >= 10000 ? '대형주' : stock.market_cap >= 3000 ? '중형주' : '소형주';

      return {
        code: stock.code, name: stock.name, market: stock.market,
        price: stock.price, marketCap: stock.market_cap, tier: stockTier,
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        porTtm: porTtm ? Math.round(porTtm * 10) / 10 : null,
        psrTtm: psrTtm ? Math.round(psrTtm * 10) / 10 : null,
        roe: quarters[0].roe, pbr: quarters[0].pbr,
        niChange, opChange, mcapChange,
        niGapRatio: niGapRatio ? Math.round(niGapRatio * 10) / 10 : null,
        turnaround, deficitTurn,
        uiQuadrant, uiIndex, uiValue, uiQuality,
        score: eng?.total_score || 0,
        verdict: eng?.verdict?.toLowerCase().replace(/\s+/g, '_') || 'hold',
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    // 필터
    let filtered = results;
    if (tier && tier !== 'all') filtered = filtered.filter(r => r.tier === tier);
    if (quadrant) filtered = filtered.filter(r => r.uiQuadrant?.includes(quadrant));

    // analyst 모드: 별도 데이터 소스
    if (mode === 'analyst') {
      const commonOnly = params.get('common_only') !== 'false';

      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const consensusList = db.prepare(`
        SELECT c.code, s.name, s.market, c.rating, c.target_price, c.consensus_eps, c.consensus_per, c.analyst_count,
               dp.close AS current_price, dp.market_cap
        FROM consensus c
        JOIN stocks s ON c.code = s.code
        JOIN daily_prices dp ON c.code = dp.code
        WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = c.code)
          AND dp.close > 0 AND c.target_price > 0
          ${market && market !== 'all' ? 'AND s.market = ?' : ''}
      `).all(...(market && market !== 'all' ? [market] : [])) as Array<{
        code: string; name: string; market: string; rating: number;
        target_price: number; consensus_eps: number; consensus_per: number;
        analyst_count: number; current_price: number; market_cap: number;
      }>;

      let analystResults = consensusList.map(c => {
        // 보통주 필터 (코드 끝자리 0)
        if (commonOnly && !c.code.endsWith('0')) return null;

        // 가중 평균 목표가
        const opinions = db.prepare(`
          SELECT date, target_price FROM analyst_opinions
          WHERE code = ? AND target_price > 0
        `).all(c.code) as Array<{ date: string; target_price: number }>;

        let weightedSum = 0, weightTotal = 0, recentCount = 0;
        for (const o of opinions) {
          const parts = o.date?.split('/');
          if (!parts || parts.length !== 3) continue;
          const d = new Date(2000 + parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          let w = 0;
          if (d >= threeMonthsAgo) { w = 1.0; recentCount++; }
          else if (d >= sixMonthsAgo) { w = 0.5; }
          if (w > 0) { weightedSum += o.target_price * w; weightTotal += w; }
        }

        const targetWeighted = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : c.target_price;
        const upside = c.current_price > 0 ? Math.round((targetWeighted - c.current_price) / c.current_price * 1000) / 10 : null;
        const stockTier = c.market_cap >= 50000 ? '초대형주' : c.market_cap >= 10000 ? '대형주' : c.market_cap >= 3000 ? '중형주' : '소형주';

        return {
          code: c.code, name: c.name, market: c.market, tier: stockTier,
          currentPrice: c.current_price, targetPriceSimple: c.target_price,
          targetPriceWeighted: targetWeighted, upside,
          rating: c.rating, analystCount: c.analyst_count, recentCount,
          marketCap: c.market_cap,
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null);

      if (tier && tier !== 'all') analystResults = analystResults.filter(r => r.tier === tier);
      analystResults.sort((a, b) => (b.upside ?? -999) - (a.upside ?? -999));

      return NextResponse.json({
        mode: 'analyst',
        modeLabel: '전문가가 더 오른다고 본 종목',
        totalCount: analystResults.length,
        data: analystResults.slice(0, limit),
      });
    }

    // 모드별 정렬
    switch (mode) {
      case 'ttm':
        filtered = filtered.filter(r => r.perTtm !== null && r.perTtm > 0);
        filtered.sort((a, b) => (a.perTtm ?? 999) - (b.perTtm ?? 999));
        break;
      case 'gap':
        filtered.sort((a, b) => (b.niGapRatio ?? -9999) - (a.niGapRatio ?? -9999));
        break;
      case 'composite':
        filtered.sort((a, b) => (b.uiIndex ?? 0) - (a.uiIndex ?? 0));
        break;
      default:
        filtered.sort((a, b) => b.score - a.score);
        break;
    }

    return NextResponse.json({
      mode,
      modeLabel: { total: '종합 저평가', ttm: '지금 싼 종목', gap: '아직 덜 오른 종목', composite: '싸고 좋은 기업', analyst: '전문가가 더 오른다고 본 종목' }[mode] || mode,
      totalCount: filtered.length,
      data: filtered.slice(0, limit),
    });
  } catch (error) {
    console.error('Undervalued API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
