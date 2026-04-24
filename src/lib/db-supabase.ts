/**
 * Supabase 기반 DB 접근 (Vercel 배포용)
 * brain.db가 없을 때 Supabase에서 동일 데이터를 조회
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function supaScores(options: {
  market?: string;
  tier?: string;
  sort?: string;
  limit?: number;
}) {
  const limit = options.limit || 50;

  let query = supabase
    .from('stock_scores')
    .select(`
      ticker, score_date, total_score, layer1_score, layer2_score, layer3_score, layer4_score,
      verdict, confidence, reasons, risks, market_cap, tier, tier_verdict,
      stocks!inner(name, market, sector)
    `)
    .order('total_score', { ascending: false })
    .limit(limit);

  if (options.tier && options.tier !== 'all') {
    query = query.eq('tier', options.tier);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  // 최신 시세 + growth 조인
  const tickers = data.map(d => d.ticker);

  const [pricesRes, growthRes] = await Promise.all([
    supabase.from('daily_prices').select('ticker, close, market_cap, volume, trade_date')
      .in('ticker', tickers).order('trade_date', { ascending: false }),
    supabase.from('growth_metrics').select('*').in('ticker', tickers),
  ]);

  const latestPrice: Record<string, Record<string, unknown>> = {};
  for (const p of (pricesRes.data || [])) { if (!latestPrice[p.ticker]) latestPrice[p.ticker] = p; }

  const growthMap: Record<string, Record<string, unknown>> = {};
  for (const g of (growthRes.data || [])) { growthMap[g.ticker] = g; }

  return data.map(d => {
    const stock = (d as Record<string, unknown>).stocks as { name: string; market: string; sector: string };
    const price = latestPrice[d.ticker];
    const growth = growthMap[d.ticker];

    // market 필터
    if (options.market && options.market !== 'all' && stock.market.toLowerCase() !== options.market) return null;

    return {
      code: d.ticker,
      name: stock.name,
      market: stock.market.toLowerCase(),
      price: (price?.close as number) || 0,
      changePct: 0,
      marketCap: d.market_cap || (price?.market_cap as number) || 0,
      tier: d.tier || '',
      priceDate: (price?.trade_date as string) || '',
      perTtm: null,
      roe: null, pbr: null, debtRatio: null, opMargin: null,
      niChange: null, opChange: null, mcapChange: null,
      niGapRatio: (growth?.undervalue_ni as number) || null,
      turnaround: false, deficitTurn: false,
      niGrowth: (growth?.net_income_growth as number) || null,
      mcapGrowth: (growth?.market_cap_growth as number) || null,
      undervalueIndex: (growth?.undervalue_ni as number) || null,
      uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null,
      ttmRevenue: 0, ttmNetIncome: 0, ttmOp: 0,
      score: d.total_score,
      verdict: d.verdict,
      confidence: d.confidence,
      reasons: d.reasons || [],
      risks: d.risks || [],
    };
  }).filter(Boolean);
}

export async function supaStockDetail(code: string) {
  const [stockRes, scoreRes, pricesRes, finRes] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', code).single(),
    supabase.from('stock_scores').select('*').eq('ticker', code).order('score_date', { ascending: false }).limit(1).single(),
    supabase.from('daily_prices').select('*').eq('ticker', code).order('trade_date', { ascending: false }).limit(120),
    supabase.from('quarterly_financials').select('*').eq('ticker', code)
      .order('fiscal_year', { ascending: false }).order('fiscal_quarter', { ascending: false }).limit(8),
  ]);

  return {
    stock: stockRes.data,
    score: scoreRes.data,
    prices: pricesRes.data || [],
    financials: finRes.data || [],
  };
}

export async function supaConsensus(code: string) {
  // consensus 테이블이 Supabase에 없으면 null
  return null;
}

export async function supaMarketRisk() {
  // macro_snapshot에서 조회
  const { data } = await supabase
    .from('macro_snapshot')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  return data;
}
