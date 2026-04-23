import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const db = getDb();

    // Stock info
    const stock = db.prepare('SELECT * FROM stocks WHERE code = ?').get(code) as {
      code: string; name: string; market: string;
    } | undefined;

    if (!stock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    // Latest price
    const latestPrice = db.prepare(`
      SELECT * FROM daily_prices WHERE code = ? ORDER BY date DESC LIMIT 1
    `).get(code) as {
      date: string; close: number; open: number; high: number; low: number;
      volume: number; market_cap: number; change_pct: number;
    };

    // Recent 60 days prices
    const prices = db.prepare(`
      SELECT date, close, volume, market_cap, change_pct
      FROM daily_prices WHERE code = ? ORDER BY date DESC LIMIT 60
    `).all(code) as Array<{
      date: string; close: number; volume: number; market_cap: number; change_pct: number;
    }>;

    // Last 8 quarterly financials
    const quarters = db.prepare(`
      SELECT * FROM financials
      WHERE code = ? AND period_type = 'quarter'
      ORDER BY period DESC LIMIT 8
    `).all(code) as Array<{
      period: string; revenue: number; operating_profit: number; net_income: number;
      op_margin: number | null; net_margin: number | null; roe: number | null;
      debt_ratio: number | null; quick_ratio: number | null;
      eps: number | null; per: number | null; bps: number | null; pbr: number | null;
      is_estimate: number;
    }>;

    // TTM calculation
    const recent4 = quarters.slice(0, 4);
    const prev4 = quarters.slice(4, 8);
    const ttmRevenue = recent4.reduce((s, q) => s + (q.revenue || 0), 0);
    const ttmOp = recent4.reduce((s, q) => s + (q.operating_profit || 0), 0);
    const ttmNi = recent4.reduce((s, q) => s + (q.net_income || 0), 0);
    const prevTtmNi = prev4.reduce((s, q) => s + (q.net_income || 0), 0);

    const perTtm = ttmNi > 0 ? latestPrice.market_cap / ttmNi : null;
    const porTtm = ttmOp > 0 ? latestPrice.market_cap / ttmOp : null;
    const psrTtm = ttmRevenue > 0 ? latestPrice.market_cap / ttmRevenue : null;

    // Gap analysis
    let niGrowth = null;
    let mcapGrowth = null;
    if (prevTtmNi > 0 && ttmNi > 0) {
      niGrowth = ((ttmNi - prevTtmNi) / prevTtmNi) * 100;
    }
    const yearAgoPrice = db.prepare(`
      SELECT market_cap FROM daily_prices
      WHERE code = ? AND date <= date(?, '-1 year')
      ORDER BY date DESC LIMIT 1
    `).get(code, latestPrice.date) as { market_cap: number } | undefined;

    if (yearAgoPrice && yearAgoPrice.market_cap > 0) {
      mcapGrowth = ((latestPrice.market_cap - yearAgoPrice.market_cap) / yearAgoPrice.market_cap) * 100;
    }

    const undervalueIndex = (niGrowth !== null && mcapGrowth !== null) ? niGrowth - mcapGrowth : null;

    // Annual financials for trend
    const annuals = db.prepare(`
      SELECT period, revenue, operating_profit, net_income, roe, debt_ratio
      FROM financials WHERE code = ? AND period_type = 'annual'
      ORDER BY period DESC LIMIT 5
    `).all(code) as Array<{
      period: string; revenue: number; operating_profit: number; net_income: number;
      roe: number | null; debt_ratio: number | null;
    }>;

    const latest = recent4[0] || {};

    return NextResponse.json({
      code: stock.code,
      name: stock.name,
      market: stock.market,
      price: latestPrice.close,
      changePct: latestPrice.change_pct,
      marketCap: latestPrice.market_cap,
      priceDate: latestPrice.date,
      valuation: {
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        porTtm: porTtm ? Math.round(porTtm * 10) / 10 : null,
        psrTtm: psrTtm ? Math.round(psrTtm * 100) / 100 : null,
        pbr: latest.pbr,
        roe: latest.roe,
        debtRatio: latest.debt_ratio,
        opMargin: latest.op_margin,
        eps: latest.eps,
        ttmRevenue, ttmOp, ttmNi,
        periods: recent4.map(q => q.period),
      },
      gap: {
        niGrowth: niGrowth ? Math.round(niGrowth * 10) / 10 : null,
        mcapGrowth: mcapGrowth ? Math.round(mcapGrowth * 10) / 10 : null,
        undervalueIndex: undervalueIndex ? Math.round(undervalueIndex * 10) / 10 : null,
      },
      quarterlyTrend: recent4.map(q => ({
        period: q.period,
        revenue: q.revenue,
        operatingProfit: q.operating_profit,
        netIncome: q.net_income,
        isEstimate: q.is_estimate === 1,
      })).reverse(),
      annualTrend: annuals.map(a => ({
        period: a.period,
        revenue: a.revenue,
        operatingProfit: a.operating_profit,
        netIncome: a.net_income,
        roe: a.roe,
        debtRatio: a.debt_ratio,
      })).reverse(),
      recentPrices: prices.slice(0, 30).reverse(),
    });
  } catch (error) {
    console.error('Stock detail API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
