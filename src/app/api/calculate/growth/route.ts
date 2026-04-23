import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 증감율 + 저평가 인덱스 계산
// 전분기 대비 실적 증감율과 시총 증감율을 비교하여 저평가 지수 산출
// POST /api/calculate/growth?secret=...
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. 활성 종목 목록
  const { data: stocks, error: stockErr } = await supabase
    .from('stocks')
    .select('ticker')
    .eq('is_active', true);

  if (stockErr || !stocks) {
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 });
  }

  let calculated = 0;

  for (const { ticker } of stocks) {
    // 2. 최근 2개 분기 재무데이터
    const { data: fins } = await supabase
      .from('quarterly_financials')
      .select('*')
      .eq('ticker', ticker)
      .order('fiscal_year', { ascending: false })
      .order('fiscal_quarter', { ascending: false })
      .limit(2);

    if (!fins || fins.length < 2) continue;

    const current = fins[0];
    const previous = fins[1];

    // 3. 현재 시가총액
    const { data: priceData } = await supabase
      .from('daily_prices')
      .select('market_cap')
      .eq('ticker', ticker)
      .order('trade_date', { ascending: false })
      .limit(1)
      .single();

    // 이전 분기 말 시가총액 (해당 분기 마지막 거래일)
    const prevQuarterEnd = getQuarterEndDate(previous.fiscal_year, previous.fiscal_quarter);
    const { data: prevPriceData } = await supabase
      .from('daily_prices')
      .select('market_cap')
      .eq('ticker', ticker)
      .lte('trade_date', prevQuarterEnd)
      .order('trade_date', { ascending: false })
      .limit(1)
      .single();

    if (!priceData?.market_cap || !prevPriceData?.market_cap) continue;

    // 4. 증감율 계산
    const revenueGrowth = calcGrowth(current.revenue, previous.revenue);
    const opProfitGrowth = calcGrowth(current.operating_profit, previous.operating_profit);
    const netIncomeGrowth = calcGrowth(current.net_income, previous.net_income);
    const marketCapGrowth = calcGrowth(priceData.market_cap, prevPriceData.market_cap);

    // 5. 수익상태 판정
    const profitStatus = getProfitStatus(current.net_income, previous.net_income);

    // 6. 저평가 인덱스 = 실적 증감율 - 시총 증감율
    const undervalueNi = netIncomeGrowth !== null && marketCapGrowth !== null
      ? round2(netIncomeGrowth - marketCapGrowth) : null;
    const undervalueOp = opProfitGrowth !== null && marketCapGrowth !== null
      ? round2(opProfitGrowth - marketCapGrowth) : null;
    const undervalueRev = revenueGrowth !== null && marketCapGrowth !== null
      ? round2(revenueGrowth - marketCapGrowth) : null;

    const { error: upsertErr } = await supabase
      .from('growth_metrics')
      .upsert({
        ticker,
        calc_date: today,
        revenue_growth: revenueGrowth,
        op_profit_growth: opProfitGrowth,
        net_income_growth: netIncomeGrowth,
        market_cap_growth: marketCapGrowth,
        undervalue_ni: undervalueNi,
        undervalue_op: undervalueOp,
        undervalue_rev: undervalueRev,
        profit_status: profitStatus,
      }, { onConflict: 'ticker,calc_date' });

    if (!upsertErr) calculated++;
  }

  return NextResponse.json({ calculated, total: stocks.length, date: today });
}

function calcGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

function getProfitStatus(
  currentNi: number | null,
  prevNi: number | null,
): '흑자' | '흑자전환' | '적자전환' | '적자' | null {
  if (currentNi === null || prevNi === null) return null;
  if (currentNi > 0 && prevNi > 0) return '흑자';
  if (currentNi > 0 && prevNi <= 0) return '흑자전환';
  if (currentNi <= 0 && prevNi > 0) return '적자전환';
  return '적자';
}

function getQuarterEndDate(year: number, quarter: number): string {
  const month = quarter * 3;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret');
  return secret === process.env.SUPABASE_SERVICE_ROLE_KEY;
}
