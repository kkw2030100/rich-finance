export type Verdict = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type Market = 'KOSPI' | 'KOSDAQ';
export type CashflowSign = '+' | '-';

export interface StockScore {
  fundamental: number;   // 0~40
  technical: number;     // 0~30
  macro: number;         // 0~20
  seasonality: number;   // 0~10
  total: number;         // 0~100
}

export interface Verdict_Detail {
  verdict: Verdict;
  confidence: number;     // 0~100
  reasons: string[];      // 3개
  risks: string[];        // 2개
  invalidation: string;   // 무효화 조건 1개
}

export interface MarketRisk {
  trend: number;          // 0~40
  volatility: number;     // 0~25
  supply: number;         // 0~20
  event: number;          // 0~15
  total: number;          // 0~100
  level: RiskLevel;
  guide: string;
}

export interface Financials {
  revenue: number;
  revenueGrowth: number;
  operatingProfit: number;
  operatingProfitGrowth: number;
  netIncome: number;
  netIncomeGrowth: number;
  marketCap: number;
  marketCapGrowth: number;
  roe: number;
  per: number;
  pbr: number;
  debtRatio: number;
  currentRatio: number;
  operatingMargin: number;
  netMargin: number;
  eps: number;
  undervalueIndex: number; // 저평가 지수: 순이익증감율 - 시총증감율
}

export interface CashflowPattern {
  operating: CashflowSign;
  investing: CashflowSign;
  financing: CashflowSign;
  label: string;
  score: number;
}

export interface Stock {
  ticker: string;
  name: string;
  market: Market;
  sector: string;
  price: number;
  priceChange: number;
  financials: Financials;
  cashflow: CashflowPattern;
  score: StockScore;
  verdict: Verdict_Detail;
  killZone: boolean;       // true = 위험 신호 제외 대상
  killReason?: string;
}

export interface SectorSummary {
  name: string;
  stockCount: number;
  avgUndervalueIndex: number;
  topStock: string;
  trend: 'up' | 'down' | 'flat';
}
