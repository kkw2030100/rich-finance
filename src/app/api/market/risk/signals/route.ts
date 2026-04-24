import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaRiskSignals } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

const US_ETF_MAP: Record<string, string> = { sp500: 'SPY', nasdaq: 'QQQ', dow: 'DIA' };

function calcRiskFromETF(db: ReturnType<typeof getDb>, etfCode: string): Array<{ date: string; risk: number }> {
  const prices = db.prepare(`
    SELECT date, close FROM daily_prices WHERE code = ? ORDER BY date ASC
  `).all(etfCode) as Array<{ date: string; close: number }>;

  const result: Array<{ date: string; risk: number }> = [];
  for (let i = 1; i < prices.length; i++) {
    const change = (prices[i].close - prices[i - 1].close) / prices[i - 1].close * 100;
    const start = Math.max(0, i - 20);
    const window = prices.slice(start, i + 1);
    let vol = 0;
    if (window.length >= 2) {
      const changes = [];
      for (let j = 1; j < window.length; j++) {
        changes.push(Math.abs((window[j].close - window[j - 1].close) / window[j - 1].close * 100));
      }
      vol = changes.reduce((s, v) => s + v, 0) / changes.length;
    }
    const ma5 = prices.slice(Math.max(0, i - 4), i + 1).reduce((s, p) => s + p.close, 0) / Math.min(5, i + 1);
    const ma20 = prices.slice(Math.max(0, i - 19), i + 1).reduce((s, p) => s + p.close, 0) / Math.min(20, i + 1);

    let risk = 30;
    risk += Math.min(25, Math.round(vol * 12));
    if (change < -1) risk += 15;
    else if (change < -0.3) risk += 8;
    else if (change > 0.5) risk -= 5;
    if (ma5 < ma20) risk += 12;
    risk = Math.min(100, Math.max(0, risk));

    result.push({ date: prices[i].date, risk });
  }
  return result;
}

function calcRiskFromMarket(db: ReturnType<typeof getDb>, market: string): Array<{ date: string; risk: number }> {
  const dates = db.prepare(`SELECT DISTINCT date FROM daily_prices ORDER BY date ASC`).all() as Array<{ date: string }>;
  const result: Array<{ date: string; risk: number }> = [];

  for (const { date } of dates) {
    const stats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN change_pct > 0 THEN 1 ELSE 0 END) as up_count,
        AVG(change_pct) as avg_change, AVG(ABS(change_pct)) as avg_volatility
      FROM daily_prices dp JOIN stocks s ON dp.code = s.code
      WHERE dp.date = ? AND s.market = ?
    `).get(date, market) as { total: number; up_count: number; avg_change: number; avg_volatility: number } | undefined;

    if (!stats || stats.total === 0) continue;
    const upRatio = stats.up_count / stats.total;
    let risk = Math.round((1 - upRatio) * 40) + Math.min(30, Math.round((stats.avg_volatility || 0) * 10));
    if (stats.avg_change < -1) risk += 30;
    else if (stats.avg_change < -0.5) risk += 20;
    else if (stats.avg_change < 0) risk += 10;
    risk = Math.min(100, Math.max(0, risk));
    result.push({ date, risk });
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    if (!isLocalDb()) {
      const data = await supaRiskSignals();
      return NextResponse.json(data);
    }

    const db = getDb();
    const market = req.nextUrl.searchParams.get('market') || 'kospi';

    const isUS = market in US_ETF_MAP;
    const riskHistory = isUS
      ? calcRiskFromETF(db, US_ETF_MAP[market])
      : calcRiskFromMarket(db, market);

    // 리밸런싱 신호 감지
    const signals: Array<{ date: string; type: string; risk: number; reason: string; cashRecommend: number }> = [];

    for (let i = 1; i < riskHistory.length; i++) {
      const prev = riskHistory[i - 1];
      const curr = riskHistory[i];
      if (prev.risk >= 50 && curr.risk <= 30) {
        signals.push({ date: curr.date, type: 'buy', risk: curr.risk, reason: `위험도 ${prev.risk}→${curr.risk} 하락 전환`, cashRecommend: 20 });
      }
      if (prev.risk <= 30 && curr.risk >= 50) {
        signals.push({ date: curr.date, type: 'sell', risk: curr.risk, reason: `위험도 ${prev.risk}→${curr.risk} 상승 전환`, cashRecommend: 50 });
      }
      if (curr.risk - prev.risk >= 20) {
        signals.push({ date: curr.date, type: 'sell', risk: curr.risk, reason: `위험도 1일 ${curr.risk - prev.risk}p 급등`, cashRecommend: 60 });
      }
    }

    const latest = riskHistory[riskHistory.length - 1];
    let cashRecommend = 30, guide = '선별 매수';
    if (latest) {
      if (latest.risk <= 20) { cashRecommend = 10; guide = '적극 매수'; }
      else if (latest.risk <= 30) { cashRecommend = 20; guide = '분할 매수'; }
      else if (latest.risk <= 50) { cashRecommend = 30; guide = '선별 매수'; }
      else if (latest.risk <= 70) { cashRecommend = 50; guide = '추격 자제'; }
      else { cashRecommend = 70; guide = '관망 우세'; }
    }

    return NextResponse.json({
      market,
      signals: signals.slice(-20),
      current: { risk: latest?.risk ?? 0, date: latest?.date ?? '', cashRecommend, guide },
    });
  } catch (error) {
    console.error('Risk signals API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
