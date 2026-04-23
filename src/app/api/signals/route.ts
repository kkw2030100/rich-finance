import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const type = req.nextUrl.searchParams.get('type') || 'turnaround';
    const latestDate = (db.prepare('SELECT MAX(date) as d FROM daily_prices').get() as { d: string }).d;

    if (type === 'turnaround') {
      // 흑자전환: 최근 분기 흑자 & 전분기 적자
      const rows = db.prepare(`
        SELECT f1.code, s.name, s.market,
          f2.net_income as prev_ni, f1.net_income as curr_ni,
          f1.period as curr_period, f2.period as prev_period,
          f1.revenue, f1.operating_profit,
          dp.close as price, dp.change_pct, dp.market_cap
        FROM financials f1
        JOIN financials f2 ON f1.code = f2.code AND f2.period_type = 'quarter'
        JOIN stocks s ON f1.code = s.code
        LEFT JOIN daily_prices dp ON f1.code = dp.code AND dp.date = ?
        WHERE f1.period_type = 'quarter'
          AND f1.net_income > 0
          AND f2.net_income < 0
          AND f1.period = (SELECT MAX(period) FROM financials WHERE code = f1.code AND period_type = 'quarter')
          AND f2.period = (SELECT MAX(period) FROM financials WHERE code = f2.code AND period_type = 'quarter' AND period < f1.period)
        ORDER BY f1.net_income DESC
        LIMIT 30
      `).all(latestDate);

      return NextResponse.json({ type, count: rows.length, data: rows });
    }

    if (type === 'volume_spike') {
      // 거래량 급증: 20일 평균 대비 300%+
      const rows = db.prepare(`
        SELECT dp.code, s.name, s.market,
          dp.volume, dp.close as price, dp.change_pct, dp.market_cap,
          (SELECT AVG(volume) FROM daily_prices WHERE code = dp.code AND date < dp.date ORDER BY date DESC LIMIT 20) as avg_volume
        FROM daily_prices dp
        JOIN stocks s ON dp.code = s.code
        WHERE dp.date = ?
          AND dp.volume > 0
        ORDER BY dp.volume DESC
        LIMIT 200
      `).all(latestDate) as Array<{
        code: string; name: string; market: string;
        volume: number; price: number; change_pct: number; market_cap: number;
        avg_volume: number | null;
      }>;

      const spikes = rows
        .filter(r => r.avg_volume && r.avg_volume > 0 && r.volume > r.avg_volume * 3)
        .map(r => ({
          ...r,
          volumeRatio: r.avg_volume ? Math.round((r.volume / r.avg_volume) * 10) / 10 : null,
        }))
        .sort((a, b) => (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0))
        .slice(0, 30);

      return NextResponse.json({ type, count: spikes.length, data: spikes });
    }

    if (type === 'gap_change') {
      // 괴리율 상위: 순이익 증감 대비 시총 증감 괴리가 큰 종목
      const rows = db.prepare(`
        SELECT s.code, s.name, s.market,
          dp.close as price, dp.change_pct, dp.market_cap
        FROM stocks s
        JOIN daily_prices dp ON s.code = dp.code AND dp.date = ?
        WHERE dp.market_cap > 1000
        ORDER BY dp.market_cap DESC
        LIMIT 300
      `).all(latestDate) as Array<{
        code: string; name: string; market: string;
        price: number; change_pct: number; market_cap: number;
      }>;

      const results = rows.map(stock => {
        const quarters = db.prepare(`
          SELECT net_income FROM financials
          WHERE code = ? AND period_type = 'quarter'
          ORDER BY period DESC LIMIT 8
        `).all(stock.code) as Array<{ net_income: number }>;

        if (quarters.length < 8) return null;

        const ttmNi = quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0);
        const prevNi = quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);

        if (prevNi === 0 || ttmNi <= 0) return null;

        const niGrowth = ((ttmNi - prevNi) / Math.abs(prevNi)) * 100;
        const firstPrice = db.prepare(`
          SELECT market_cap FROM daily_prices WHERE code = ? AND market_cap > 0 ORDER BY date ASC LIMIT 1
        `).get(stock.code) as { market_cap: number } | undefined;

        if (!firstPrice || firstPrice.market_cap <= 0) return null;
        const mcapGrowth = ((stock.market_cap - firstPrice.market_cap) / firstPrice.market_cap) * 100;
        const gap = niGrowth - mcapGrowth;

        return {
          ...stock,
          niGrowth: Math.round(niGrowth * 10) / 10,
          mcapGrowth: Math.round(mcapGrowth * 10) / 10,
          gap: Math.round(gap * 10) / 10,
        };
      }).filter(Boolean).sort((a, b) => (b?.gap ?? 0) - (a?.gap ?? 0)).slice(0, 30);

      return NextResponse.json({ type, count: results.length, data: results });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Signals API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
