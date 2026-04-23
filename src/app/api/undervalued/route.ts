import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getTier(mcap: number) {
  if (mcap >= 50000) return '초대형주';
  if (mcap >= 10000) return '대형주';
  if (mcap >= 3000) return '중형주';
  return '소형주';
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const mode = req.nextUrl.searchParams.get('mode') || 'total';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const market = req.nextUrl.searchParams.get('market') || 'all';

    // 전종목 + 최신 시세
    const stocks = db.prepare(`
      SELECT s.code, s.name, s.market,
        dp.close AS price, dp.change_pct, dp.market_cap, dp.date AS price_date
      FROM stocks s
      JOIN daily_prices dp ON s.code = dp.code
      WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code)
        AND dp.market_cap > 0
        ${market !== 'all' ? 'AND s.market = ?' : ''}
    `).all(...(market !== 'all' ? [market] : [])) as Array<{
      code: string; name: string; market: string;
      price: number; change_pct: number; market_cap: number; price_date: string;
    }>;

    const results = stocks.map(stock => {
      const quarters = db.prepare(`
        SELECT period, revenue, operating_profit, net_income, is_estimate
        FROM financials WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT 8
      `).all(stock.code) as Array<{
        period: string; revenue: number; operating_profit: number; net_income: number; is_estimate: number;
      }>;

      if (quarters.length < 4) return null;

      const recent4 = quarters.slice(0, 4);
      const prev4 = quarters.slice(4, 8);

      const ttmRevenue = recent4.reduce((s, q) => s + (q.revenue || 0), 0);
      const ttmOp = recent4.reduce((s, q) => s + (q.operating_profit || 0), 0);
      const ttmNi = recent4.reduce((s, q) => s + (q.net_income || 0), 0);
      const prevTtmNi = prev4.length >= 4 ? prev4.reduce((s, q) => s + (q.net_income || 0), 0) : null;

      // TTM 밸류에이션
      const perTtm = ttmNi > 0 ? stock.market_cap / ttmNi : null;
      const porTtm = ttmOp > 0 ? stock.market_cap / ttmOp : null;
      const psrTtm = ttmRevenue > 0 ? stock.market_cap / ttmRevenue : null;

      // 증감액 기반 괴리율 (mode=gap)
      let niChangeAmount: number | null = null;
      let mcapChangeAmount: number | null = null;
      let gapPct: number | null = null;
      let profitStatus: string | null = null;

      if (prevTtmNi !== null) {
        niChangeAmount = ttmNi - prevTtmNi;

        const firstPrice = db.prepare(`
          SELECT market_cap FROM daily_prices WHERE code = ? AND market_cap > 0 ORDER BY date ASC LIMIT 1
        `).get(stock.code) as { market_cap: number } | undefined;

        if (firstPrice) {
          mcapChangeAmount = stock.market_cap - firstPrice.market_cap;
        }

        if (mcapChangeAmount !== null && stock.market_cap > 0) {
          gapPct = (niChangeAmount / stock.market_cap) * 100 - (mcapChangeAmount / stock.market_cap) * 100;
        }

        // 흑자/적자 전환 태그
        if (prevTtmNi < 0 && ttmNi > 0) profitStatus = 'turnaround';
        else if (prevTtmNi > 0 && ttmNi < 0) profitStatus = 'loss_turn';
      }

      // DART 복합인덱스 (mode=composite)
      const dart = db.prepare(`
        SELECT * FROM dart_financials WHERE code = ? ORDER BY year DESC LIMIT 1
      `).get(stock.code) as Record<string, unknown> | undefined;

      let valueScore: number | null = null;
      let qualityScore: number | null = null;
      let quadrant: string | null = null;

      if (dart) {
        const totalAssets = dart.total_assets as number;
        const grossProfit = dart.gross_profit as number;
        const fcf = dart.fcf as number;
        const totalEquity = dart.total_equity as number;
        const totalLiab = dart.total_liabilities as number;

        // 간이 value/quality 스코어
        const gpa = totalAssets > 0 ? (grossProfit || 0) / totalAssets : 0;
        const debtAsset = totalAssets > 0 ? (totalLiab || 0) / totalAssets : 1;

        qualityScore = Math.min(100, Math.max(0, Math.round(
          (gpa > 0.3 ? 40 : gpa > 0.15 ? 25 : 10) +
          (debtAsset < 0.3 ? 30 : debtAsset < 0.5 ? 20 : 5) +
          (fcf && fcf > 0 ? 30 : 10)
        )));

        const pbr = stock.market_cap > 0 && totalEquity ? stock.market_cap / (totalEquity as number * 100000000) : null;
        valueScore = Math.min(100, Math.max(0, Math.round(
          (perTtm && perTtm > 0 && perTtm < 8 ? 40 : perTtm && perTtm < 15 ? 25 : 10) +
          (pbr && pbr < 1 ? 35 : pbr && pbr < 2 ? 20 : 5) +
          (gapPct && gapPct > 30 ? 25 : gapPct && gapPct > 0 ? 15 : 5)
        )));

        if (valueScore >= 50 && qualityScore >= 50) quadrant = '저평가+고품질';
        else if (valueScore < 50 && qualityScore >= 50) quadrant = '고평가+고품질';
        else if (valueScore >= 50 && qualityScore < 50) quadrant = '저평가+저품질';
        else quadrant = '고평가+저품질';
      }

      return {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        price: stock.price,
        changePct: stock.change_pct,
        marketCap: stock.market_cap,
        tier: getTier(stock.market_cap),
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        porTtm: porTtm ? Math.round(porTtm * 10) / 10 : null,
        psrTtm: psrTtm ? Math.round(psrTtm * 100) / 100 : null,
        ttmNi,
        ttmOp,
        ttmRevenue,
        niChangeAmount,
        mcapChangeAmount,
        gapPct: gapPct ? Math.round(gapPct * 10) / 10 : null,
        profitStatus,
        valueScore,
        qualityScore,
        quadrant,
      };
    }).filter(Boolean);

    // 모드별 정렬
    let sorted;
    switch (mode) {
      case 'ttm':
        sorted = results
          .filter(r => r && r.perTtm && r.perTtm > 0)
          .sort((a, b) => (a!.perTtm ?? 999) - (b!.perTtm ?? 999));
        break;
      case 'gap':
        sorted = results
          .filter(r => r && r.gapPct !== null)
          .sort((a, b) => (b!.gapPct ?? -999) - (a!.gapPct ?? -999));
        break;
      case 'composite':
        sorted = results
          .filter(r => r && r.valueScore !== null && r.qualityScore !== null)
          .sort((a, b) => ((b!.valueScore ?? 0) + (b!.qualityScore ?? 0)) - ((a!.valueScore ?? 0) + (a!.qualityScore ?? 0)));
        break;
      default: // total
        sorted = results
          .filter(r => r && (r.perTtm || r.gapPct))
          .sort((a, b) => {
            const aScore = (a!.perTtm && a!.perTtm > 0 ? (20 - Math.min(a!.perTtm, 20)) * 3 : 0) + (a!.gapPct ?? 0);
            const bScore = (b!.perTtm && b!.perTtm > 0 ? (20 - Math.min(b!.perTtm, 20)) * 3 : 0) + (b!.gapPct ?? 0);
            return bScore - aScore;
          });
    }

    return NextResponse.json({
      mode,
      timestamp: new Date().toISOString(),
      count: sorted.length,
      data: sorted.slice(0, limit),
    });
  } catch (error) {
    console.error('Undervalued API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
