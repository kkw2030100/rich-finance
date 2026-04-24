import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaRiskHistory } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

// 미국 지수 → ETF 코드 매핑
const US_ETF_MAP: Record<string, string> = {
  sp500: 'SPY',
  nasdaq: 'QQQ',
  dow: 'DIA',
};

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') || 'kospi';
    const period = req.nextUrl.searchParams.get('period') || '1y';

    if (!isLocalDb()) {
      const data = await supaRiskHistory(market, period);
      return NextResponse.json(data);
    }

    const db = getDb();

    const daysMap: Record<string, number> = { '3m': 63, '6m': 126, '1y': 252, '3y': 756 };
    const days = daysMap[period] || 252;
    const sampleEvery = period === '3m' ? 1 : period === '6m' ? 2 : period === '3y' ? 5 : 3;

    const isUS = market in US_ETF_MAP;
    const etfCode = US_ETF_MAP[market];

    let history: Array<{ date: string; risk: number; avgChange: number }>;

    if (isUS && etfCode) {
      // 미국: ETF 시세 기반 위험도 계산
      const prices = db.prepare(`
        SELECT date, close, volume FROM daily_prices
        WHERE code = ? ORDER BY date DESC LIMIT ?
      `).all(etfCode, days) as Array<{ date: string; close: number; volume: number }>;

      if (prices.length < 5) {
        return NextResponse.json({ market, period, data: [] });
      }

      const reversed = [...prices].reverse();
      history = [];

      for (let i = 0; i < reversed.length; i += sampleEvery) {
        const p = reversed[i];
        const prevIdx = Math.max(0, i - 1);
        const prev = reversed[prevIdx];
        const changePct = prev.close > 0 ? ((p.close - prev.close) / prev.close) * 100 : 0;

        // 변동성 계산 (최근 20일)
        const start = Math.max(0, i - 20);
        const window = reversed.slice(start, i + 1);
        let volatility = 0;
        if (window.length >= 2) {
          const changes = [];
          for (let j = 1; j < window.length; j++) {
            changes.push(Math.abs((window[j].close - window[j - 1].close) / window[j - 1].close * 100));
          }
          volatility = changes.reduce((s, v) => s + v, 0) / changes.length;
        }

        // 추세 판단 (5일 vs 20일 MA)
        const ma5window = reversed.slice(Math.max(0, i - 4), i + 1);
        const ma20window = reversed.slice(Math.max(0, i - 19), i + 1);
        const ma5 = ma5window.reduce((s, v) => s + v.close, 0) / ma5window.length;
        const ma20 = ma20window.reduce((s, v) => s + v.close, 0) / ma20window.length;
        const trendDown = ma5 < ma20;

        // 위험도 계산
        let risk = 30; // baseline
        risk += Math.min(25, Math.round(volatility * 12)); // 변동성
        if (changePct < -1) risk += 15;
        else if (changePct < -0.3) risk += 8;
        else if (changePct > 0.5) risk -= 5;
        if (trendDown) risk += 12;
        risk = Math.min(100, Math.max(0, risk));

        history.push({
          date: p.date,
          risk,
          avgChange: Math.round(changePct * 100) / 100,
        });
      }
    } else {
      // 한국: 기존 로직 (시장 전체 종목 기반)
      const dates = db.prepare(`
        SELECT DISTINCT date FROM daily_prices ORDER BY date DESC LIMIT ?
      `).all(days) as Array<{ date: string }>;

      const allDates = [...dates].reverse();
      history = [];

      for (let i = 0; i < allDates.length; i += sampleEvery) {
        const { date } = allDates[i];
        const stats = db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN change_pct > 0 THEN 1 ELSE 0 END) as up_count,
            AVG(change_pct) as avg_change,
            AVG(ABS(change_pct)) as avg_volatility
          FROM daily_prices dp
          JOIN stocks s ON dp.code = s.code
          WHERE dp.date = ? AND s.market = ?
        `).get(date, market) as { total: number; up_count: number; avg_change: number; avg_volatility: number } | undefined;

        if (!stats || stats.total === 0) continue;

        const upRatio = stats.up_count / stats.total;
        let risk = Math.round((1 - upRatio) * 40) + Math.min(30, Math.round((stats.avg_volatility || 0) * 10));
        if (stats.avg_change < -1) risk += 30;
        else if (stats.avg_change < -0.5) risk += 20;
        else if (stats.avg_change < 0) risk += 10;
        risk = Math.min(100, Math.max(0, risk));

        history.push({
          date,
          risk,
          avgChange: Math.round((stats.avg_change || 0) * 100) / 100,
        });
      }
    }

    return NextResponse.json({ market, period, data: history });
  } catch (error) {
    console.error('Risk history API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
