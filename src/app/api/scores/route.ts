import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const params = req.nextUrl.searchParams;
    const market = params.get('market') || 'all';
    const sort = params.get('sort') || 'undervalue';
    const limit = parseInt(params.get('limit') || '50');

    // Get all stocks with latest price and financials
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

    // Get latest quarterly financials for each stock
    const results = stocks.map(stock => {
      // Get recent quarterly financials (last 4 quarters)
      const quarters = db.prepare(`
        SELECT * FROM financials
        WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT 4
      `).all(stock.code) as Array<{
        period: string; revenue: number; operating_profit: number; net_income: number;
        op_margin: number | null; net_margin: number | null; roe: number | null;
        debt_ratio: number | null; eps: number | null; per: number | null;
        pbr: number | null; is_estimate: number;
      }>;

      if (quarters.length === 0) return null;

      const latest = quarters[0];

      // TTM calculation (sum of last 4 quarters)
      const ttmRevenue = quarters.reduce((s, q) => s + (q.revenue || 0), 0);
      const ttmNetIncome = quarters.reduce((s, q) => s + (q.net_income || 0), 0);
      const ttmOp = quarters.reduce((s, q) => s + (q.operating_profit || 0), 0);

      // TTM PER
      const perTtm = ttmNetIncome > 0 ? stock.market_cap / ttmNetIncome : null;

      // Get YoY comparison (same quarter, 1 year ago)
      const yoyQuarter = db.prepare(`
        SELECT net_income, revenue, operating_profit FROM financials
        WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT 4 OFFSET 4
      `).all(stock.code) as Array<{ net_income: number; revenue: number; operating_profit: number }>;

      let niGrowth: number | null = null;
      let mcapGrowth: number | null = null;
      let undervalueIndex: number | null = null;

      if (yoyQuarter.length > 0) {
        const prevTtmNi = yoyQuarter.reduce((s, q) => s + (q.net_income || 0), 0);
        if (prevTtmNi > 0 && ttmNetIncome > 0) {
          niGrowth = ((ttmNetIncome - prevTtmNi) / prevTtmNi) * 100;
        }

        // Market cap growth (1 year ago)
        const yearAgoPrice = db.prepare(`
          SELECT market_cap FROM daily_prices
          WHERE code = ? AND date <= date(?, '-1 year')
          ORDER BY date DESC LIMIT 1
        `).get(stock.code, stock.price_date) as { market_cap: number } | undefined;

        if (yearAgoPrice && yearAgoPrice.market_cap > 0) {
          mcapGrowth = ((stock.market_cap - yearAgoPrice.market_cap) / yearAgoPrice.market_cap) * 100;
        }

        if (niGrowth !== null && mcapGrowth !== null) {
          undervalueIndex = niGrowth - mcapGrowth;
        }
      }

      // Simple scoring (approximation of 4-layer engine)
      let score = 50; // base
      if (perTtm !== null && perTtm > 0 && perTtm < 10) score += 10;
      else if (perTtm !== null && perTtm > 0 && perTtm < 20) score += 5;
      if (latest.roe && latest.roe > 15) score += 8;
      else if (latest.roe && latest.roe > 10) score += 4;
      if (latest.debt_ratio && latest.debt_ratio < 100) score += 4;
      if (undervalueIndex !== null && undervalueIndex > 50) score += 8;
      else if (undervalueIndex !== null && undervalueIndex > 20) score += 4;
      if (stock.change_pct > 0) score += 2;
      score = Math.min(score, 100);

      let verdict = 'hold';
      if (score >= 75) verdict = 'strong_buy';
      else if (score >= 60) verdict = 'buy';
      else if (score <= 25) verdict = 'strong_sell';
      else if (score <= 40) verdict = 'sell';

      return {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        price: stock.price,
        changePct: stock.change_pct,
        marketCap: stock.market_cap,
        priceDate: stock.price_date,
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        roe: latest.roe,
        pbr: latest.pbr,
        debtRatio: latest.debt_ratio,
        opMargin: latest.op_margin,
        niGrowth: niGrowth ? Math.round(niGrowth * 10) / 10 : null,
        mcapGrowth: mcapGrowth ? Math.round(mcapGrowth * 10) / 10 : null,
        undervalueIndex: undervalueIndex ? Math.round(undervalueIndex * 10) / 10 : null,
        ttmRevenue,
        ttmNetIncome,
        ttmOp,
        score,
        verdict,
      };
    }).filter(Boolean);

    // Sort
    const sorted = results.sort((a, b) => {
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
    results.forEach(r => { if (r) dist[r.verdict as keyof typeof dist]++; });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalCount: results.length,
      distribution: dist,
      data: sorted,
    });
  } catch (error) {
    console.error('Scores API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
