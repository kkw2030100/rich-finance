// Supabase DB 타입 — 스키마 v1.0 기준 수동 정의
// 나중에 `supabase gen types typescript`로 자동 생성 가능

export type Verdict = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type MarketType = 'KOSPI' | 'KOSDAQ';
export type MarketStateType = 'bull' | 'bear' | 'crash' | 'sideways' | 'theme' | 'earnings_season';
export type ProfitStatus = '흑자' | '흑자전환' | '적자전환' | '적자';
export type AlertType = 'urgent' | 'daily' | 'weekly' | 'score_change' | 'kill_zone';

export interface DbStock {
  ticker: string;
  name: string;
  market: MarketType;
  sector: string | null;
  sub_sector: string | null;
  listed_date: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface DbDailyPrice {
  ticker: string;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  trading_value: number | null;
  market_cap: number | null;
  shares: number | null;
  foreign_ratio: number | null;
}

export interface DbQuarterlyFinancials {
  ticker: string;
  fiscal_year: number;
  fiscal_quarter: number;
  is_estimated: boolean;
  revenue: number | null;
  operating_profit: number | null;
  net_income: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  operating_cf: number | null;
  investing_cf: number | null;
  financing_cf: number | null;
  interest_expense: number | null;
  roe: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  debt_ratio: number | null;
  current_ratio: number | null;
  operating_margin: number | null;
  net_margin: number | null;
}

export interface DbGrowthMetrics {
  ticker: string;
  calc_date: string;
  revenue_growth: number | null;
  op_profit_growth: number | null;
  net_income_growth: number | null;
  market_cap_growth: number | null;
  undervalue_ni: number | null;
  undervalue_op: number | null;
  undervalue_rev: number | null;
  profit_status: ProfitStatus | null;
}

export interface DbKillZone {
  ticker: string;
  check_date: string;
  is_killed: boolean;
  audit_fail: boolean;
  capital_impair: boolean;
  interest_cover: boolean;
  negative_cf: boolean;
  cb_repeat: boolean;
  mgmt_warning: boolean;
  kill_reason: string | null;
}

export interface DbStockScore {
  ticker: string;
  score_date: string;
  layer1_score: number;
  layer2_score: number;
  layer3_score: number;
  layer4_score: number;
  total_score: number;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  verdict: Verdict;
  confidence: number;
  reasons: string[];
  risks: string[];
  invalidation: string | null;
}

export interface DbMacroSnapshot {
  snapshot_date: string;
  interest_rate: number | null;
  rate_direction: string | null;
  rate_score: number | null;
  business_cycle: string | null;
  cycle_score: number | null;
  vix: number | null;
  yield_spread: number | null;
  credit_spread: number | null;
  risk_score: number | null;
  total_score: number | null;
  kospi_index: number | null;
  kosdaq_index: number | null;
  exchange_rate: number | null;
  oil_price: number | null;
  gold_price: number | null;
  fear_greed_index: number | null;
  detail_json: Record<string, unknown> | null;
}

export interface DbSeasonalitySnapshot {
  snapshot_date: string;
  year_cycle_score: number | null;
  month_score: number | null;
  month_end_score: number | null;
  total_score: number | null;
  detail_json: Record<string, unknown> | null;
}

export interface DbMarketState {
  judge_date: string;
  state: MarketStateType;
  strategy: string;
  cash_ratio: number | null;
  detail_json: Record<string, unknown> | null;
}

export interface DbRelativeStrength {
  ticker: string;
  calc_date: string;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  index_return_1w: number | null;
  index_return_1m: number | null;
  index_return_3m: number | null;
  excess_1w: number | null;
  excess_1m: number | null;
  excess_3m: number | null;
  rs_score: number | null;
  market_cap_group: string | null;
}

export interface DbAlert {
  id: number;
  user_id: string | null;
  alert_type: AlertType;
  ticker: string | null;
  title: string;
  body: string | null;
  channel: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DbWatchlist {
  user_id: string;
  ticker: string;
  added_at: string;
  memo: string | null;
}

export interface DbPortfolio {
  id: number;
  user_id: string;
  ticker: string;
  quantity: number;
  avg_price: number;
  target_price: number | null;
  stop_loss: number | null;
  kelly_ratio: number | null;
  added_at: string;
}
