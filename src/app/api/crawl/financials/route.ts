import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchFinancials } from '@/lib/crawl/naver-finance';

// 분기 재무제표 수집
// POST /api/crawl/financials?secret=...&ticker=000660  (특정 종목)
// POST /api/crawl/financials?secret=...                  (전종목)
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const specificTicker = req.nextUrl.searchParams.get('ticker');

  let tickers: string[];

  if (specificTicker) {
    tickers = [specificTicker];
  } else {
    const { data: stocks, error } = await supabase
      .from('stocks')
      .select('ticker')
      .eq('is_active', true);

    if (error || !stocks) {
      return NextResponse.json({ error: 'Failed to fetch stock list' }, { status: 500 });
    }
    tickers = stocks.map((s) => s.ticker);
  }

  let success = 0;
  let failed = 0;
  const batchSize = 5;

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const financials = await fetchFinancials(ticker);
        if (financials.length === 0) return null;

        const rows = financials.map((f) => ({
          ticker: f.ticker,
          fiscal_year: f.fiscalYear,
          fiscal_quarter: f.fiscalQuarter,
          is_estimated: f.isEstimated,
          revenue: f.revenue,
          operating_profit: f.operatingProfit,
          net_income: f.netIncome,
          roe: f.roe,
          eps: f.eps,
          per: f.per,
          pbr: f.pbr,
          debt_ratio: f.debtRatio,
          operating_margin: f.operatingMargin,
        }));

        const { error } = await supabase
          .from('quarterly_financials')
          .upsert(rows, { onConflict: 'ticker,fiscal_year,fiscal_quarter' });

        if (error) throw error;
        return ticker;
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) success++;
      else failed++;
    }

    // 속도 제한
    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return NextResponse.json({ success, failed, total: tickers.length });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret');
  return secret === process.env.SUPABASE_SERVICE_ROLE_KEY;
}
