/**
 * Supabase 기반 DB 접근 (Vercel 배포용)
 * brain.db가 없을 때 Supabase에서 동일 데이터를 조회
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── scores ───
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
    if (options.market && options.market !== 'all' && stock.market.toLowerCase() !== options.market) return null;
    return {
      code: d.ticker, name: stock.name, market: stock.market.toLowerCase(),
      price: (price?.close as number) || 0, changePct: 0,
      marketCap: d.market_cap || (price?.market_cap as number) || 0,
      tier: d.tier || '', priceDate: (price?.trade_date as string) || '',
      perTtm: null, roe: null, pbr: null, debtRatio: null, opMargin: null,
      niChange: null, opChange: null, mcapChange: null,
      niGapRatio: (growth?.undervalue_ni as number) || null,
      turnaround: false, deficitTurn: false,
      niGrowth: (growth?.net_income_growth as number) || null,
      mcapGrowth: (growth?.market_cap_growth as number) || null,
      undervalueIndex: (growth?.undervalue_ni as number) || null,
      uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null,
      ttmRevenue: 0, ttmNetIncome: 0, ttmOp: 0,
      score: d.total_score, verdict: d.verdict, confidence: d.confidence,
      reasons: d.reasons || [], risks: d.risks || [],
    };
  }).filter(Boolean);
}

// ─── stock detail ───
export async function supaStockDetail(code: string) {
  const [stockRes, scoreRes, pricesRes, finRes, killRes] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', code).single(),
    supabase.from('stock_scores').select('*').eq('ticker', code).order('score_date', { ascending: false }).limit(1).single(),
    supabase.from('daily_prices').select('*').eq('ticker', code).order('trade_date', { ascending: false }).limit(120),
    supabase.from('quarterly_financials').select('*').eq('ticker', code)
      .order('fiscal_year', { ascending: false }).order('fiscal_quarter', { ascending: false }).limit(8),
    supabase.from('kill_zone').select('*').eq('ticker', code).order('check_date', { ascending: false }).limit(1).single(),
  ]);

  const stock = stockRes.data;
  const prices = pricesRes.data || [];
  const fins = finRes.data || [];
  const score = scoreRes.data;
  const latestPrice = prices[0];

  // 간이 TTM
  const ttmRevenue = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.revenue as number) || 0), 0);
  const ttmOp = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.operating_profit as number) || 0), 0);
  const ttmNi = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.net_income as number) || 0), 0);
  const mcap = latestPrice?.market_cap || 0;
  const perTtm = ttmNi > 0 && mcap > 0 ? Math.round(mcap / ttmNi * 10) / 10 : null;

  // quarterlyTrend 변환
  const quarterlyTrend = fins.map((f: Record<string, unknown>) => ({
    period: `${f.fiscal_year}.${String(((f.fiscal_quarter as number) || 1) * 3).padStart(2, '0')}`,
    revenue: (f.revenue as number) || 0,
    operatingProfit: (f.operating_profit as number) || 0,
    netIncome: (f.net_income as number) || 0,
    isEstimate: f.is_estimated as boolean,
  }));

  return {
    code: stock?.ticker || code,
    name: stock?.name || code,
    market: stock?.market || 'KOSPI',
    price: latestPrice?.close || 0,
    changePct: 0,
    marketCap: mcap,
    priceDate: latestPrice?.trade_date || '',
    valuation: {
      perTtm, porTtm: null, psrTtm: null,
      pbr: fins[0]?.pbr || null, roe: fins[0]?.roe || null,
      debtRatio: fins[0]?.debt_ratio || null, opMargin: fins[0]?.operating_margin || null,
      eps: fins[0]?.eps || null,
      ttmRevenue, ttmOp, ttmNi, periods: [],
    },
    gap: { niGrowth: null, mcapGrowth: null, undervalueIndex: null },
    quarterlyTrend,
    annualTrend: [],
    recentPrices: prices.slice(0, 30).map((p: Record<string, unknown>) => ({
      date: p.trade_date, close: p.close, volume: p.volume, market_cap: p.market_cap, change_pct: 0,
    })),
    score: score?.total_score || 0,
    verdict: score?.verdict || 'hold',
  };
}

// ─── prices ───
export async function supaPrices(code: string, days: number) {
  const { data } = await supabase
    .from('daily_prices')
    .select('trade_date, open, high, low, close, volume, market_cap')
    .eq('ticker', code)
    .order('trade_date', { ascending: false })
    .limit(days);

  return (data || []).map(p => ({
    date: p.trade_date, open: p.open, high: p.high, low: p.low,
    close: p.close, volume: p.volume, market_cap: p.market_cap, change_pct: 0,
  }));
}

// ─── undervalued ───
export async function supaUndervalued(options: { mode?: string; limit?: number; tier?: string }) {
  const data = await supaScores({ ...options, sort: 'score', limit: options.limit || 30 });
  return {
    mode: options.mode || 'total',
    modeLabel: { total: '종합 저평가', ttm: '지금 싼 종목', gap: '아직 덜 오른 종목', composite: '싸고 좋은 기업', analyst: '전문가 의견' }[options.mode || 'total'] || 'total',
    totalCount: data.length,
    data,
  };
}

// ─── signals (흑자전환 등) ───
export async function supaSignals() {
  // Supabase에서는 간이 응답
  return {
    turnaround: [], turnaroundCount: 0,
    volumeSpike: [], volumeSpikeCount: 0,
    gapChange: [], gapChangeCount: 0,
  };
}

// ─── market overview ───
export async function supaMarketOverview() {
  const { data: macro } = await supabase
    .from('macro_snapshot').select('*')
    .order('snapshot_date', { ascending: false }).limit(1).single();

  const { data: season } = await supabase
    .from('seasonality_snapshot').select('*')
    .order('snapshot_date', { ascending: false }).limit(1).single();

  const { data: state } = await supabase
    .from('market_state').select('*')
    .order('judge_date', { ascending: false }).limit(1).single();

  return { macro, seasonality: season, marketState: state };
}

// ─── market risk ───
export async function supaMarketRisk() {
  return {
    kr: { total: { score: 0, status: '데이터 없음', label: '한국 종합' } },
    us: { total: { score: 0, status: '데이터 없음', label: '미국 종합' } },
  };
}

// ─── risk history ───
export async function supaRiskHistory() {
  return { market: 'kospi', period: '1y', data: [] };
}

// ─── risk signals ───
export async function supaRiskSignals() {
  return { current: { risk: 0, date: '', cashRecommend: 30, guide: '데이터 없음' }, signals: [] };
}

// ─── consensus ───
export async function supaConsensus() {
  return null;
}
