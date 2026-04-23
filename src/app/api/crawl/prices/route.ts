import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchStockPrice } from '@/lib/crawl/naver-finance';

// 일별 시세 수집 — 전종목 또는 특정 종목
// POST /api/crawl/prices?secret=...&ticker=000660  (특정 종목)
// POST /api/crawl/prices?secret=...                  (전종목)
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const specificTicker = req.nextUrl.searchParams.get('ticker');
  const today = new Date().toISOString().slice(0, 10);

  let tickers: string[];

  if (specificTicker) {
    tickers = [specificTicker];
  } else {
    // 전종목 가져오기
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
  const batchSize = 10;

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const price = await fetchStockPrice(ticker);
        if (!price || !price.close) return null;

        const row = {
          ticker,
          trade_date: today,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.close,
          volume: price.volume,
          trading_value: price.tradingValue,
          market_cap: price.marketCap,
          shares: price.shares,
          foreign_ratio: price.foreignRatio,
        };

        const { error } = await supabase
          .from('daily_prices')
          .upsert(row, { onConflict: 'ticker,trade_date' });

        if (error) throw error;
        return ticker;
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) success++;
      else failed++;
    }

    // 속도 제한 — 배치 간 200ms 대기
    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return NextResponse.json({ success, failed, total: tickers.length, date: today });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret');
  return secret === process.env.SUPABASE_SERVICE_ROLE_KEY;
}
