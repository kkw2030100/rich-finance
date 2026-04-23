import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/signals?type=turnaround|volume_spike|gap_change|all
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const type = req.nextUrl.searchParams.get('type') || 'all';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

    const results: {
      turnaround: Record<string, unknown>[];
      volumeSpike: Record<string, unknown>[];
      gapChange: Record<string, unknown>[];
    } = { turnaround: [], volumeSpike: [], gapChange: [] };

    // ─── 흑자전환 ───
    if (type === 'all' || type === 'turnaround') {
      const stocks = db.prepare(`
        SELECT s.code, s.name, s.market, dp.close, dp.market_cap, dp.change_pct
        FROM stocks s
        JOIN daily_prices dp ON s.code = dp.code
        WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code)
      `).all() as Array<{ code: string; name: string; market: string; close: number; market_cap: number; change_pct: number }>;

      for (const stock of stocks) {
        const quarters = db.prepare(`
          SELECT period, net_income FROM financials
          WHERE code = ? AND period_type = 'quarter' ORDER BY period DESC LIMIT 2
        `).all(stock.code) as Array<{ period: string; net_income: number }>;

        if (quarters.length < 2) continue;
        if ((quarters[1].net_income || 0) <= 0 && (quarters[0].net_income || 0) > 0) {
          results.turnaround.push({
            code: stock.code, name: stock.name, market: stock.market,
            price: stock.close, marketCap: stock.market_cap,
            prevNi: quarters[1].net_income, currNi: quarters[0].net_income,
            prevPeriod: quarters[1].period, currPeriod: quarters[0].period,
          });
        }
      }
    }

    // ─── 거래량 급증 (20일 평균 대비 300%+) ───
    if (type === 'all' || type === 'volume_spike') {
      const spikes = db.prepare(`
        WITH latest AS (
          SELECT code, date, volume, close, market_cap, change_pct
          FROM daily_prices WHERE date = (SELECT MAX(date) FROM daily_prices) AND volume > 0
        ),
        avg20 AS (
          SELECT dp.code, AVG(dp.volume) as avg_vol
          FROM daily_prices dp JOIN latest l ON dp.code = l.code
          WHERE dp.date > date(l.date, '-30 days') AND dp.date < l.date AND dp.volume > 0
          GROUP BY dp.code HAVING COUNT(*) >= 10
        )
        SELECT l.code, s.name, s.market, l.close AS price, l.market_cap AS marketCap,
               l.change_pct AS changePct, l.volume, a.avg_vol AS avgVolume,
               ROUND(CAST(l.volume AS REAL) / a.avg_vol * 100, 0) AS volumeRatio
        FROM latest l JOIN avg20 a ON l.code = a.code JOIN stocks s ON l.code = s.code
        WHERE CAST(l.volume AS REAL) / a.avg_vol >= 3.0
        ORDER BY volumeRatio DESC LIMIT ?
      `).all(limit) as Record<string, unknown>[];
      results.volumeSpike = spikes;
    }

    // ─── 괴리율 TOP (시총대비 50%+ 괴리) ───
    if (type === 'all' || type === 'gap_change') {
      const stocks = db.prepare(`
        SELECT s.code, s.name, s.market, dp.close, dp.market_cap
        FROM stocks s JOIN daily_prices dp ON s.code = dp.code
        WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code) AND dp.market_cap > 0
      `).all() as Array<{ code: string; name: string; market: string; close: number; market_cap: number }>;

      const gaps: Record<string, unknown>[] = [];
      for (const stock of stocks) {
        const quarters = db.prepare(`
          SELECT net_income FROM financials WHERE code = ? AND period_type = 'quarter' ORDER BY period DESC LIMIT 8
        `).all(stock.code) as Array<{ net_income: number }>;
        if (quarters.length < 2) continue;

        const niChange = quarters.length >= 8
          ? quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0) - quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0)
          : (quarters[0].net_income || 0) - (quarters[1].net_income || 0);

        const yearAgo = db.prepare(`SELECT market_cap FROM daily_prices WHERE code = ? AND market_cap > 0 ORDER BY date ASC LIMIT 1`).get(stock.code) as { market_cap: number } | undefined;
        if (!yearAgo) continue;

        const mcapChange = stock.market_cap - yearAgo.market_cap;
        const niGapRatio = ((niChange * 10 - mcapChange) / stock.market_cap) * 100;

        if (Math.abs(niGapRatio) > 50) {
          gaps.push({
            code: stock.code, name: stock.name, market: stock.market,
            price: stock.close, marketCap: stock.market_cap,
            niChange, mcapChange, niGapRatio: Math.round(niGapRatio * 10) / 10,
          });
        }
      }
      gaps.sort((a, b) => Math.abs(b.niGapRatio as number) - Math.abs(a.niGapRatio as number));
      results.gapChange = gaps.slice(0, limit);
    }

    return NextResponse.json({
      turnaround: results.turnaround.slice(0, limit),
      turnaroundCount: results.turnaround.length,
      volumeSpike: results.volumeSpike.slice(0, limit),
      volumeSpikeCount: results.volumeSpike.length,
      gapChange: results.gapChange.slice(0, limit),
      gapChangeCount: results.gapChange.length,
    });
  } catch (error) {
    console.error('Signals API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
