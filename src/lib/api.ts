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
  // 증감액 기반 (v2)
  niChange: number | null;
  opChange: number | null;
  mcapChange: number | null;
  niGapRatio: number | null;
  turnaround: boolean;
  deficitTurn: boolean;
  // 하위 호환
  niGrowth: number | null;
  opGrowth: number | null;
  mcapGrowth: number | null;
  undervalueIndex: number | null;
  ttmRevenue: number;
  ttmNetIncome: number;
  ttmOp: number;
  score: number;
  verdict: string;
}

export interface PeriodInfo {
  key: string;       // 'q3m' | 'q6m' | 'q9m' | 'q1y' | 'q1.5y' | 'a1y' | 'a2y' | 'a3y' | '1y_default'
  label: string;     // '3개월' 등
  unit: 'quarter' | 'annual';
  days: number;
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD
}

export interface ScoresResponse {
  timestamp: string;
  totalCount: number;
  distribution: Record<string, number>;
  dataSource?: 'local' | 'supabase';
  periodInfo?: PeriodInfo;
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
  period?: string;  // '3m' | '6m' | '1y' | '3y'
}): Promise<ScoresResponse> {
  const sp = new URLSearchParams();
  if (params?.market && params.market !== 'all') sp.set('market', params.market);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.tier && params.tier !== 'all') sp.set('tier', params.tier);
  if (params?.period && params.period !== '1y') sp.set('period', params.period);
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

/**
 * 시장별 가격 표시.
 * - KR: 원 (정수)
 * - US: $X.XX (소수점 2자리)
 */
export function formatPrice(n: number | null | undefined, market: string): string {
  if (n == null) return '-';
  const m = (market || '').toLowerCase();
  if (m === 'us') return '$' + n.toFixed(2);
  return n.toLocaleString() + '원';
}

/**
 * 시장별 통화 금액 표시 (시총, 매출, 영업이익, 순이익 등).
 * 두 시장 모두 '억' 단위로 저장됨 (financials는 raw_value/10^8).
 * - KR: 억원 단위 → '조' / '억' 표기
 * - US: 억USD 단위 → $T / $B / $M 표기 (음수도 처리)
 */
export function formatMoney(n: number | null | undefined, market: string): string {
  if (n == null || n === 0) return '-';
  const m = (market || '').toLowerCase();
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (m === 'us') {
    // 억USD → $T(=10000), $B(=10), $M(=0.01)
    if (abs >= 10000) return sign + '$' + (abs / 10000).toFixed(2) + 'T';
    if (abs >= 10) return sign + '$' + (abs / 10).toFixed(1) + 'B';
    return sign + '$' + Math.round(abs * 100).toLocaleString() + 'M';
  }
  if (abs >= 10000) return sign + (abs / 10000).toFixed(1) + '조';
  return sign + abs.toLocaleString() + '억';
}

export function formatPct(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}

export function deriveTier(marketCap: number | null | undefined, market: string): string | null {
  const m = (market || '').toLowerCase();
  if (m === 'us') return '미국주식';
  if (!marketCap || marketCap <= 0) return null;  // 시총 데이터 결측 — 폴백하지 않음
  if (marketCap >= 50000) return '초대형주';
  if (marketCap >= 10000) return '대형주';
  if (marketCap >= 3000) return '중형주';
  return '소형주';
}

export function getCountry(market: string): string {
  return (market || '').toLowerCase() === 'us' ? 'us' : 'kr';
}

/**
 * 한국 우선주 식별: 6자리 코드의 마지막 자리가 '0'이 아니면 우선주.
 * - 005380 (현대차, 보통주) → false
 * - 005385 (현대차우), 005387 (현대차2우B), 00088K (한화3우B) → true
 * - 미국 종목은 항상 false (적용 안 함)
 */
export function isPreferredStock(code: string, market: string): boolean {
  if ((market || '').toLowerCase() === 'us') return false;
  if (!code || code.length !== 6) return false;
  return code[5] !== '0';
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
