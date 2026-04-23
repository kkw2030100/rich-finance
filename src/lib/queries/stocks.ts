import { createClient } from '@/lib/supabase/server';
import type { Stock } from '@/types/stock';
import type { DbStock, DbDailyPrice, DbGrowthMetrics, DbStockScore, DbKillZone } from '@/types/database';

// 종목 리스트 (홈 + 종목탭용) — 최신 스코어 + 증감율 조인
export async function getStockList(options?: {
  market?: 'KOSPI' | 'KOSDAQ';
  sector?: string;
  minNetIncome?: number; // 순이익 최소 필터 (백만원)
  sortBy?: 'undervalue_ni' | 'undervalue_op' | 'total_score' | 'market_cap';
  limit?: number;
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // 기본 종목 + 최신 시세
  let query = supabase
    .from('stocks')
    .select(`
      ticker, name, market, sector,
      daily_prices!inner(close, volume, trading_value, market_cap, foreign_ratio, trade_date),
      growth_metrics(
        revenue_growth, op_profit_growth, net_income_growth, market_cap_growth,
        undervalue_ni, undervalue_op, undervalue_rev, profit_status, calc_date
      ),
      stock_scores(
        layer1_score, layer2_score, layer3_score, layer4_score, total_score,
        verdict, confidence, reasons, risks, invalidation, score_date
      ),
      kill_zone(is_killed, kill_reason, check_date)
    `)
    .eq('is_active', true);

  if (options?.market) {
    query = query.eq('market', options.market);
  }
  if (options?.sector) {
    query = query.eq('sector', options.sector);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getStockList error:', error);
    return [];
  }

  return data || [];
}

// 종목 상세 (종목 상세 페이지용)
export async function getStockDetail(ticker: string) {
  const supabase = await createClient();

  const [stockRes, pricesRes, financialsRes, scoresRes, killRes, growthRes] = await Promise.all([
    supabase
      .from('stocks')
      .select('*')
      .eq('ticker', ticker)
      .single(),

    supabase
      .from('daily_prices')
      .select('*')
      .eq('ticker', ticker)
      .order('trade_date', { ascending: false })
      .limit(120), // 최근 120일

    supabase
      .from('quarterly_financials')
      .select('*')
      .eq('ticker', ticker)
      .order('fiscal_year', { ascending: false })
      .order('fiscal_quarter', { ascending: false })
      .limit(8), // 최근 8분기

    supabase
      .from('stock_scores')
      .select('*')
      .eq('ticker', ticker)
      .order('score_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('kill_zone')
      .select('*')
      .eq('ticker', ticker)
      .order('check_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('growth_metrics')
      .select('*')
      .eq('ticker', ticker)
      .order('calc_date', { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    stock: stockRes.data as DbStock | null,
    prices: (pricesRes.data || []) as DbDailyPrice[],
    financials: financialsRes.data || [],
    score: scoresRes.data as DbStockScore | null,
    killZone: killRes.data as DbKillZone | null,
    growth: growthRes.data as DbGrowthMetrics | null,
  };
}

// 시장 개요 (홈 + 마켓 페이지용)
export async function getMarketOverview() {
  const supabase = await createClient();

  const [macroRes, seasonRes, stateRes] = await Promise.all([
    supabase
      .from('macro_snapshot')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('seasonality_snapshot')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('market_state')
      .select('*')
      .order('judge_date', { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    macro: macroRes.data,
    seasonality: seasonRes.data,
    marketState: stateRes.data,
  };
}

// 상대강도 랭킹
export async function getRelativeStrengthRanking(options?: {
  period?: '1w' | '1m' | '3m';
  marketCapGroup?: '대형' | '중형' | '소형';
  limit?: number;
}) {
  const supabase = await createClient();
  const sortCol = options?.period === '1w' ? 'excess_1w'
    : options?.period === '3m' ? 'excess_3m'
    : 'excess_1m';

  let query = supabase
    .from('relative_strength')
    .select(`
      *,
      stocks!inner(name, market, sector)
    `)
    .order(sortCol, { ascending: false })
    .limit(options?.limit || 50);

  if (options?.marketCapGroup) {
    query = query.eq('market_cap_group', options.marketCapGroup);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getRelativeStrengthRanking error:', error);
    return [];
  }

  return data || [];
}
