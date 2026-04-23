import { createClient } from '@/lib/supabase/server';

// ─── 홈: TOP 종목 (스코어 높은 순) ───
export async function getTopPicks(limit = 8) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_scores')
    .select(`
      ticker, score_date, total_score, layer1_score, layer2_score, layer3_score, layer4_score,
      verdict, confidence, reasons, risks,
      stocks!inner(name, market, sector)
    `)
    .order('total_score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // 각 종목의 최신 시세 + growth 조인
  const tickers = data.map(d => d.ticker);

  const [pricesRes, growthRes] = await Promise.all([
    supabase
      .from('daily_prices')
      .select('ticker, close, volume, market_cap, trade_date')
      .in('ticker', tickers)
      .order('trade_date', { ascending: false }),
    supabase
      .from('growth_metrics')
      .select('ticker, undervalue_ni, undervalue_op, net_income_growth, market_cap_growth, profit_status')
      .in('ticker', tickers),
  ]);

  // ticker별 최신 1건만
  const latestPrice: Record<string, { close: number; volume: number; market_cap: number }> = {};
  for (const p of (pricesRes.data || [])) {
    if (!latestPrice[p.ticker]) latestPrice[p.ticker] = p;
  }

  const growthMap: Record<string, typeof growthRes.data extends (infer T)[] | null ? T : never> = {};
  for (const g of (growthRes.data || [])) {
    growthMap[g.ticker] = g;
  }

  return data.map(d => {
    const stock = (d as Record<string, unknown>).stocks as { name: string; market: string; sector: string };
    const price = latestPrice[d.ticker];
    const growth = growthMap[d.ticker];
    return {
      ticker: d.ticker,
      name: stock.name,
      market: stock.market,
      sector: stock.sector || '',
      totalScore: d.total_score,
      layer1: d.layer1_score,
      layer2: d.layer2_score,
      layer3: d.layer3_score,
      layer4: d.layer4_score,
      verdict: d.verdict,
      confidence: d.confidence,
      reasons: d.reasons || [],
      risks: d.risks || [],
      close: price?.close || 0,
      volume: price?.volume || 0,
      marketCap: price?.market_cap || 0,
      undervalueNi: growth?.undervalue_ni || 0,
      undervalueOp: growth?.undervalue_op || 0,
      niGrowth: growth?.net_income_growth || 0,
      mcapGrowth: growth?.market_cap_growth || 0,
      profitStatus: growth?.profit_status || null,
    };
  });
}

// ─── 종목 리스트 (전체) ───
export async function getStockList(options?: {
  market?: string;
  verdict?: string;
  sortBy?: 'total_score' | 'undervalue_ni' | 'market_cap';
  limit?: number;
}) {
  const supabase = await createClient();
  const limit = options?.limit || 50;

  let query = supabase
    .from('stock_scores')
    .select(`
      ticker, total_score, verdict, confidence, reasons, risks,
      layer1_score, layer2_score, layer3_score, layer4_score,
      stocks!inner(name, market, sector)
    `)
    .order('total_score', { ascending: false })
    .limit(limit);

  if (options?.verdict) {
    query = query.eq('verdict', options.verdict);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const tickers = data.map(d => d.ticker);

  const [pricesRes, growthRes, killRes] = await Promise.all([
    supabase.from('daily_prices').select('ticker, close, market_cap, trade_date')
      .in('ticker', tickers).order('trade_date', { ascending: false }),
    supabase.from('growth_metrics').select('*').in('ticker', tickers),
    supabase.from('kill_zone').select('ticker, is_killed, kill_reason').in('ticker', tickers),
  ]);

  const latestPrice: Record<string, Record<string, unknown>> = {};
  for (const p of (pricesRes.data || [])) { if (!latestPrice[p.ticker]) latestPrice[p.ticker] = p; }

  const growthMap: Record<string, Record<string, unknown>> = {};
  for (const g of (growthRes.data || [])) { growthMap[g.ticker] = g; }

  const killMap: Record<string, Record<string, unknown>> = {};
  for (const k of (killRes.data || [])) { killMap[k.ticker] = k; }

  let results = data.map(d => {
    const stock = (d as Record<string, unknown>).stocks as { name: string; market: string; sector: string };
    const price = latestPrice[d.ticker];
    const growth = growthMap[d.ticker];
    const kill = killMap[d.ticker];

    return {
      ticker: d.ticker,
      name: stock.name,
      market: stock.market,
      sector: stock.sector || '',
      totalScore: d.total_score,
      layer1: d.layer1_score,
      layer2: d.layer2_score,
      layer3: d.layer3_score,
      layer4: d.layer4_score,
      verdict: d.verdict,
      confidence: d.confidence,
      reasons: d.reasons || [],
      risks: d.risks || [],
      close: (price?.close as number) || 0,
      marketCap: (price?.market_cap as number) || 0,
      undervalueNi: (growth?.undervalue_ni as number) || 0,
      undervalueOp: (growth?.undervalue_op as number) || 0,
      niGrowth: (growth?.net_income_growth as number) || 0,
      mcapGrowth: (growth?.market_cap_growth as number) || 0,
      profitStatus: (growth?.profit_status as string) || null,
      killZone: (kill?.is_killed as boolean) || false,
      killReason: (kill?.kill_reason as string) || null,
    };
  });

  if (options?.market) {
    results = results.filter(r => r.market === options.market);
  }

  return results;
}

// ─── 종목 상세 ───
export async function getStockDetail(ticker: string) {
  const supabase = await createClient();

  const [stockRes, scoreRes, pricesRes, finRes, growthRes, killRes] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', ticker).single(),
    supabase.from('stock_scores').select('*').eq('ticker', ticker).order('score_date', { ascending: false }).limit(1).single(),
    supabase.from('daily_prices').select('*').eq('ticker', ticker).order('trade_date', { ascending: false }).limit(120),
    supabase.from('quarterly_financials').select('*').eq('ticker', ticker)
      .order('fiscal_year', { ascending: false }).order('fiscal_quarter', { ascending: false }).limit(8),
    supabase.from('growth_metrics').select('*').eq('ticker', ticker)
      .order('calc_date', { ascending: false }).limit(1).single(),
    supabase.from('kill_zone').select('*').eq('ticker', ticker)
      .order('check_date', { ascending: false }).limit(1).single(),
  ]);

  return {
    stock: stockRes.data,
    score: scoreRes.data,
    prices: pricesRes.data || [],
    financials: finRes.data || [],
    growth: growthRes.data,
    killZone: killRes.data,
  };
}
