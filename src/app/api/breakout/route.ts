import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaBreakout } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

/**
 * Stage 2 Breakout 신호 종목
 *
 * GET /api/breakout?limit=50&new_only=false
 *
 * 응답: 가장 최근 스캔 날짜의 신호 종목들 + 첫 발견일
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const limit = parseInt(params.get('limit') || '50');
    const newOnly = params.get('new_only') === 'true';
    const signalType = (params.get('type') || 'confluence').toLowerCase();
    const ALLOWED = ['weekly', 'daily', 'confluence',
                     'mid_rapid', 'mid_steady', 'late_stage',
                     'mid_rapid_daily', 'mid_steady_daily', 'late_stage_daily'];
    const validType = ALLOWED.includes(signalType) ? signalType : 'confluence';

    if (!isLocalDb()) {
      const result = await supaBreakout({ limit, newOnly, signalType: validType });
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=3600',
        },
      });
    }

    const db = getDb();

    // 가장 최근 스캔 날짜 (해당 signal_type 기준)
    const latestRow = db.prepare('SELECT MAX(scan_date) as d FROM stage2_signals WHERE signal_type = ?').get(validType) as { d: string };
    const latest = latestRow?.d;
    if (!latest) {
      return NextResponse.json({ data: [], asOf: null, signalType: validType });
    }

    // 어제 스캔 (있으면)
    const prevRow = db.prepare('SELECT MAX(scan_date) as d FROM stage2_signals WHERE signal_type = ? AND scan_date < ?').get(validType, latest) as { d: string };
    const prev = prevRow?.d;

    // 오늘 신호 종목
    const todayRows = db.prepare(`
      SELECT s.code, st.name, st.market, s.score, s.box_pos, s.ma_diff,
             s.ma60_slope, s.vol_ratio, s.ret_4w, s.confirmed
      FROM stage2_signals s
      JOIN stocks st ON st.code = s.code
      WHERE s.scan_date = ? AND s.signal_type = ?
      ORDER BY s.score DESC
      LIMIT ?
    `).all(latest, validType, limit) as Array<{
      code: string; name: string; market: string;
      score: number; box_pos: number; ma_diff: number;
      ma60_slope: number; vol_ratio: number; ret_4w: number;
      confirmed: number;
    }>;

    // 어제 종목 set
    const prevCodes = new Set<string>(
      prev ? (db.prepare('SELECT code FROM stage2_signals WHERE scan_date = ? AND signal_type = ?').all(prev, validType) as Array<{code: string}>).map(r => r.code) : []
    );

    // 첫 발견일 (현재 신호 흐름 기준 — 7일 이내 연속)
    const firstSeenMap = new Map<string, string>();
    for (const r of todayRows) {
      const dates = (db.prepare(`
        SELECT scan_date FROM stage2_signals WHERE code = ? AND signal_type = ? ORDER BY scan_date DESC
      `).all(r.code, validType) as Array<{scan_date: string}>).map(x => x.scan_date);

      let first = dates[0];
      for (let i = 1; i < dates.length; i++) {
        const dPrev = new Date(dates[i-1]);
        const dCurr = new Date(dates[i]);
        const gap = Math.abs((dPrev.getTime() - dCurr.getTime()) / 86400000);
        if (gap > 7) break;
        first = dates[i];
      }
      firstSeenMap.set(r.code, first);
    }

    // 최신 종가 (메타용)
    const tickers = todayRows.map(r => r.code);
    const placeholders = tickers.map(() => '?').join(',');
    const priceRows = tickers.length > 0 ? db.prepare(`
      SELECT code, close, change_pct, market_cap FROM daily_prices
      WHERE code IN (${placeholders}) AND date = (SELECT MAX(date) FROM daily_prices)
    `).all(...tickers) as Array<{code: string; close: number; change_pct: number; market_cap: number}> : [];
    const priceMap = new Map(priceRows.map(p => [p.code, p]));

    const data = todayRows
      .map(r => ({
        code: r.code,
        name: r.name,
        market: r.market === 'kospi' ? 'KOSPI' : 'KOSDAQ',
        score: r.score,
        boxPos: r.box_pos,
        maDiff: r.ma_diff,
        ma60Slope: r.ma60_slope,
        volRatio: r.vol_ratio,
        ret4w: r.ret_4w,
        confirmed: !!r.confirmed,
        isNew: !prevCodes.has(r.code),
        firstSeen: firstSeenMap.get(r.code) || latest,
        price: priceMap.get(r.code)?.close ?? null,
        changePct: priceMap.get(r.code)?.change_pct ?? null,
        marketCap: priceMap.get(r.code)?.market_cap ?? null,
      }))
      .filter(d => !newOnly || d.isNew);

    return NextResponse.json({
      data,
      asOf: latest,
      prevDate: prev,
      newCount: data.filter(d => d.isNew).length,
      keptCount: data.filter(d => !d.isNew).length,
      signalType: validType,
    });
  } catch (e) {
    console.error('breakout API error:', e);
    return NextResponse.json({ data: [], error: String(e) }, { status: 500 });
  }
}
