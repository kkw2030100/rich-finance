const BASE = '';  // same origin

export interface ScoreItem {
  code: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  marketCap: number;
  priceDate: string;
  perTtm: number | null;
  roe: number | null;
  pbr: number | null;
  debtRatio: number | null;
  opMargin: number | null;
  niGrowth: number | null;
  mcapGrowth: number | null;
  undervalueIndex: number | null;
  ttmRevenue: number;
  ttmNetIncome: number;
  ttmOp: number;
  score: number;
  verdict: string;
}

export interface ScoresResponse {
  timestamp: string;
  totalCount: number;
  distribution: Record<string, number>;
  data: ScoreItem[];
}

export interface StockDetailResponse {
  code: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  marketCap: number;
  priceDate: string;
  valuation: {
    perTtm: number | null;
    porTtm: number | null;
    psrTtm: number | null;
    pbr: number | null;
    roe: number | null;
    debtRatio: number | null;
    opMargin: number | null;
    eps: number | null;
    ttmRevenue: number;
    ttmOp: number;
    ttmNi: number;
    periods: string[];
  };
  gap: {
    niGrowth: number | null;
    mcapGrowth: number | null;
    undervalueIndex: number | null;
  };
  quarterlyTrend: Array<{
    period: string;
    revenue: number;
    operatingProfit: number;
    netIncome: number;
    isEstimate: boolean;
  }>;
  annualTrend: Array<{
    period: string;
    revenue: number;
    operatingProfit: number;
    netIncome: number;
    roe: number | null;
    debtRatio: number | null;
  }>;
  recentPrices: Array<{
    date: string;
    close: number;
    volume: number;
    market_cap: number;
    change_pct: number;
  }>;
}

export async function fetchScores(params?: {
  market?: string;
  sort?: string;
  limit?: number;
  tier?: string;
}): Promise<ScoresResponse> {
  const sp = new URLSearchParams();
  if (params?.market && params.market !== 'all') sp.set('market', params.market);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.tier && params.tier !== 'all') sp.set('tier', params.tier);
  const res = await fetch(`${BASE}/api/scores?${sp.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch scores');
  return res.json();
}

export async function fetchStockDetail(code: string): Promise<StockDetailResponse> {
  const res = await fetch(`${BASE}/api/stocks/${code}`);
  if (!res.ok) throw new Error('Failed to fetch stock detail');
  return res.json();
}

export function formatBillion(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '조';
  return n.toLocaleString() + '억';
}

export function formatPct(n: number | null): string {
  if (n === null) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}

export function getVerdictInfo(verdict: string) {
  switch (verdict) {
    case 'strong_buy': return { label: 'Strong Buy', color: '#00C853' };
    case 'buy': return { label: 'Buy', color: '#4CAF50' };
    case 'hold': return { label: 'Hold', color: '#9E9E9E' };
    case 'sell': return { label: 'Sell', color: '#FF9800' };
    case 'strong_sell': return { label: 'Strong Sell', color: '#F44336' };
    default: return { label: '-', color: '#6b7280' };
  }
}
