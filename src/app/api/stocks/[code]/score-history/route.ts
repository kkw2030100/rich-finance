import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * GET /api/stocks/[code]/score-history?weeks=80
 * 종목별 시점별 종합점수 시계열 (0~100)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const weeks = parseInt(req.nextUrl.searchParams.get('weeks') || '80');

    if (isLocalDb()) {
      const db = getDb();
      const rows = db.prepare(`
        SELECT date, total_score, l1_score, l2_score, l3_score, l4_score, l5_score, l6_score
        FROM stock_score_history
        WHERE code = ?
        ORDER BY date DESC
        LIMIT ?
      `).all(code, weeks) as Array<{
        date: string; total_score: number;
        l1_score: number; l2_score: number; l3_score: number;
        l4_score: number; l5_score: number; l6_score: number;
      }>;
      return NextResponse.json({
        data: rows.reverse().map(r => ({
          date: r.date,
          total: r.total_score,
          l1: r.l1_score, l2: r.l2_score, l3: r.l3_score,
          l4: r.l4_score, l5: r.l5_score, l6: r.l6_score,
        })),
      });
    }

    // Supabase
    const r = await supabase
      .from('stock_score_history')
      .select('date, total_score, l1_score, l2_score, l3_score, l4_score, l5_score, l6_score')
      .eq('code', code)
      .order('date', { ascending: false })
      .limit(weeks);

    const data = (r.data || []).reverse().map(d => ({
      date: d.date,
      total: d.total_score,
      l1: d.l1_score, l2: d.l2_score, l3: d.l3_score,
      l4: d.l4_score, l5: d.l5_score, l6: d.l6_score,
    }));
    return NextResponse.json({ data });
  } catch (e) {
    console.error('score-history error:', e);
    return NextResponse.json({ data: [], error: String(e) }, { status: 500 });
  }
}
