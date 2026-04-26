import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * 종목별 Stage 2 신호 정보
 * GET /api/stage2/[code]
 *
 * 응답: 가장 최근 신호 + 첫 발견일 + 신호 이력
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (isLocalDb()) {
      const db = getDb();
      const sigs = db.prepare(`
        SELECT scan_date, score, box_pos, ma_diff, ma60_slope, vol_ratio, ret_4w, confirmed
        FROM stage2_signals WHERE code = ? ORDER BY scan_date DESC
      `).all(code) as Array<{
        scan_date: string; score: number; box_pos: number; ma_diff: number;
        ma60_slope: number; vol_ratio: number; ret_4w: number; confirmed: number;
      }>;

      if (sigs.length === 0) {
        return NextResponse.json({ hasSignal: false });
      }

      const latest = sigs[0];
      // 첫 발견일 (7일 이내 연속 신호의 가장 오래된 것)
      let firstSeen = latest.scan_date;
      for (let i = 1; i < sigs.length; i++) {
        const dPrev = new Date(sigs[i-1].scan_date);
        const dCurr = new Date(sigs[i].scan_date);
        const gap = Math.abs((dPrev.getTime() - dCurr.getTime()) / 86400000);
        if (gap > 7) break;
        firstSeen = sigs[i].scan_date;
      }
      const daysSince = Math.round(
        (new Date(latest.scan_date).getTime() - new Date(firstSeen).getTime()) / 86400000
      );

      return NextResponse.json({
        hasSignal: true,
        latest: {
          scanDate: latest.scan_date,
          score: latest.score,
          boxPos: latest.box_pos,
          maDiff: latest.ma_diff,
          ma60Slope: latest.ma60_slope,
          volRatio: latest.vol_ratio,
          ret4w: latest.ret_4w,
          confirmed: !!latest.confirmed,
        },
        firstSeen,
        daysSince,
        history: sigs.slice(0, 30).map(s => ({
          date: s.scan_date,
          score: s.score,
          confirmed: !!s.confirmed,
        })),
      });
    }

    // Supabase
    const sigsRes = await supabase
      .from('stage2_signals')
      .select('*')
      .eq('ticker', code)
      .order('scan_date', { ascending: false });
    const sigs = sigsRes.data || [];

    if (sigs.length === 0) {
      return NextResponse.json({ hasSignal: false });
    }

    const latest = sigs[0];
    let firstSeen = latest.scan_date;
    for (let i = 1; i < sigs.length; i++) {
      const dPrev = new Date(sigs[i-1].scan_date);
      const dCurr = new Date(sigs[i].scan_date);
      const gap = Math.abs((dPrev.getTime() - dCurr.getTime()) / 86400000);
      if (gap > 7) break;
      firstSeen = sigs[i].scan_date;
    }
    const daysSince = Math.round(
      (new Date(latest.scan_date).getTime() - new Date(firstSeen).getTime()) / 86400000
    );

    return NextResponse.json({
      hasSignal: true,
      latest: {
        scanDate: latest.scan_date,
        score: latest.score,
        boxPos: latest.box_pos,
        maDiff: latest.ma_diff,
        ma60Slope: latest.ma60_slope,
        volRatio: latest.vol_ratio,
        ret4w: latest.ret_4w,
        confirmed: latest.confirmed,
      },
      firstSeen,
      daysSince,
      history: sigs.slice(0, 30).map(s => ({
        date: s.scan_date,
        score: s.score,
        confirmed: s.confirmed,
      })),
    });
  } catch (e) {
    console.error('stage2/[code] error:', e);
    return NextResponse.json({ hasSignal: false, error: String(e) }, { status: 500 });
  }
}
