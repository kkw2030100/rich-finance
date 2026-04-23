import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllStocks } from '@/lib/crawl/naver-finance';

// 종목 마스터 업데이트 — 시가총액 상위 종목 수집
// POST /api/crawl/stocks?secret=YOUR_CRON_SECRET
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  let totalUpserted = 0;

  for (const market of ['KOSPI', 'KOSDAQ'] as const) {
    const stocks = await fetchAllStocks(market);

    if (stocks.length === 0) continue;

    const rows = stocks.map((s: { ticker: string; name: string; market: string; sector: string }) => ({
      ticker: s.ticker,
      name: s.name,
      market: s.market,
      sector: s.sector || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('stocks')
      .upsert(rows, { onConflict: 'ticker' });

    if (error) {
      console.error(`Failed to upsert ${market} stocks:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    totalUpserted += rows.length;
  }

  return NextResponse.json({ upserted: totalUpserted });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret');
  return secret === process.env.SUPABASE_SERVICE_ROLE_KEY;
}
