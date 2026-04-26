import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * 종목 검색 (필터와 무관, 전체 stocks 테이블 대상)
 * GET /api/stocks/search?q=아이티센&limit=20
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    if (!q) return NextResponse.json({ data: [] });

    const pattern = `%${q}%`;
    const { data, error } = await supabase
      .from('stocks')
      .select('ticker, name, market')
      .or(`name.ilike.${pattern},ticker.ilike.${pattern}`)
      .eq('is_active', true)
      .limit(limit);

    if (error) return NextResponse.json({ data: [], error: error.message }, { status: 500 });

    const results = (data || []).map(s => ({
      code: s.ticker,
      name: s.name,
      market: (s.market || '').toLowerCase(),
    }));

    return NextResponse.json({ data: results });
  } catch (e) {
    return NextResponse.json({ data: [], error: String(e) }, { status: 500 });
  }
}
