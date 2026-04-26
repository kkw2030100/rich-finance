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
  market?: string; tier?: string; sort?: string; limit?: number;
}) {
  const limit = options.limit || 50;
  const PAGE = 1000; // Supabase row cap

  // 미국 시장: scores 없음 — stocks + daily_prices만 조회
  if (options.market === 'us' || options.tier === '미국주식') {
    // 페이지네이션으로 1000+ row 가져옴
    const stocksAll: { ticker: string; name: string; market: string; sector: string | null }[] = [];
    let usFrom = 0;
    while (stocksAll.length < limit) {
      const take = Math.min(PAGE, limit - stocksAll.length);
      const { data, error } = await supabase
        .from('stocks').select('ticker, name, market, sector')
        .eq('market', 'US').eq('is_active', true)
        .range(usFrom, usFrom + take - 1);
      if (error || !data || data.length === 0) break;
      stocksAll.push(...data);
      if (data.length < take) break;
      usFrom += take;
    }
    const stocksRes = { data: stocksAll };
    const tickers = (stocksRes.data || []).map(s => s.ticker);
    const pricesRes = tickers.length > 0
      ? await supabase.from('daily_prices').select('ticker, close, market_cap, trade_date')
          .in('ticker', tickers).order('trade_date', { ascending: false })
      : { data: [] };
    const latestPrice: Record<string, { close: number; market_cap: number | null; trade_date: string }> = {};
    for (const p of pricesRes.data || []) {
      if (!latestPrice[p.ticker]) latestPrice[p.ticker] = { close: p.close, market_cap: p.market_cap, trade_date: p.trade_date };
    }
    return (stocksRes.data || []).map(s => ({
      code: s.ticker, name: s.name, market: 'us',
      // 미국 종목은 cents 단위로 저장됨 → USD 환산
      price: latestPrice[s.ticker] ? latestPrice[s.ticker].close / 100 : 0,
      changePct: 0,
      marketCap: latestPrice[s.ticker]?.market_cap || 0,
      tier: '미국주식', priceDate: latestPrice[s.ticker]?.trade_date || '',
      perTtm: null, roe: null, pbr: null, debtRatio: null, opMargin: null,
      uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null,
      niChange: null, opChange: null, mcapChange: null, niGapRatio: null,
      turnaround: false, deficitTurn: false,
      niGrowth: null, mcapGrowth: null, undervalueIndex: null,
      ttmRevenue: 0, ttmNetIncome: 0, ttmOp: 0,
      score: 0, verdict: 'na', confidence: 0, reasons: [], risks: [],
    }));
  }

  // KR 분기: stock_scores에서 페이지네이션으로 가져옴 (Supabase 1000-row 캡 우회)
  type ScoreRow = {
    ticker: string; score_date: string; total_score: number;
    layer1_score: number; layer2_score: number; layer3_score: number; layer4_score: number;
    verdict: string; confidence: number; reasons: string[] | null; risks: string[] | null;
    market_cap: number | null; tier: string | null; tier_verdict: string | null;
    stocks: { name: string; market: string; sector: string };
  };
  const allRows: ScoreRow[] = [];
  let from = 0;
  while (allRows.length < limit) {
    const take = Math.min(PAGE, limit - allRows.length);
    let q = supabase
      .from('stock_scores')
      .select(`
        ticker, score_date, total_score, layer1_score, layer2_score, layer3_score, layer4_score,
        verdict, confidence, reasons, risks, market_cap, tier, tier_verdict,
        stocks!inner(name, market, sector)
      `)
      .order('total_score', { ascending: false })
      .range(from, from + take - 1);
    if (options.tier && options.tier !== 'all') q = q.eq('tier', options.tier);
    const { data: pageData, error } = await q;
    if (error || !pageData || pageData.length === 0) break;
    allRows.push(...(pageData as unknown as ScoreRow[]));
    if (pageData.length < take) break;
    from += take;
  }
  const data = allRows;
  if (data.length === 0) return [];

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
  }).filter((r): r is NonNullable<typeof r> => r !== null);
}

// ─── stock detail ───
export async function supaStockDetail(code: string) {
  const [stockRes, scoreRes, pricesRes, finRes] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', code).single(),
    supabase.from('stock_scores').select('*').eq('ticker', code).order('score_date', { ascending: false }).limit(1).single(),
    supabase.from('daily_prices').select('*').eq('ticker', code).order('trade_date', { ascending: false }).limit(120),
    supabase.from('quarterly_financials').select('*').eq('ticker', code)
      .order('fiscal_year', { ascending: false }).order('fiscal_quarter', { ascending: false }).limit(8),
  ]);

  const stock = stockRes.data;
  const prices = pricesRes.data || [];
  const fins = finRes.data || [];
  const score = scoreRes.data;
  const latestPrice = prices[0];

  const ttmRev = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.revenue as number) || 0), 0);
  const ttmOp = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.operating_profit as number) || 0), 0);
  const ttmNi = fins.slice(0, 4).reduce((s: number, f: Record<string, unknown>) => s + ((f.net_income as number) || 0), 0);
  const mcap = latestPrice?.market_cap || 0;
  const perTtm = ttmNi > 0 && mcap > 0 ? Math.round(mcap / ttmNi * 10) / 10 : null;

  return {
    code: stock?.ticker || code, name: stock?.name || code,
    market: stock?.market || 'KOSPI',
    price: latestPrice?.close || 0, changePct: 0, marketCap: mcap,
    priceDate: latestPrice?.trade_date || '',
    valuation: {
      perTtm, porTtm: null, psrTtm: null,
      pbr: fins[0]?.pbr || null, roe: fins[0]?.roe || null,
      debtRatio: fins[0]?.debt_ratio || null, opMargin: fins[0]?.operating_margin || null,
      eps: fins[0]?.eps || null, ttmRevenue: ttmRev, ttmOp, ttmNi, periods: [],
    },
    gap: { niGrowth: null, mcapGrowth: null, undervalueIndex: null },
    quarterlyTrend: fins.map((f: Record<string, unknown>) => ({
      period: `${f.fiscal_year}.${String(((f.fiscal_quarter as number) || 1) * 3).padStart(2, '0')}`,
      revenue: (f.revenue as number) || 0, operatingProfit: (f.operating_profit as number) || 0,
      netIncome: (f.net_income as number) || 0, isEstimate: f.is_estimated as boolean,
    })),
    annualTrend: [],
    recentPrices: prices.slice(0, 30).map((p: Record<string, unknown>) => ({
      date: p.trade_date, close: p.close, volume: p.volume, market_cap: p.market_cap, change_pct: 0,
    })),
    score: score?.total_score || 0, verdict: score?.verdict || 'hold',
  };
}

// ─── prices ───
export async function supaPrices(code: string, days: number) {
  const { data } = await supabase.from('daily_prices')
    .select('trade_date, open, high, low, close, volume, market_cap')
    .eq('ticker', code).order('trade_date', { ascending: false }).limit(days);
  // 미국 종목 cents → USD 환산
  const isUS = /^[A-Z][A-Z\.\-]{0,5}$/.test(code);
  const scale = isUS ? 100 : 1;
  return (data || []).map(p => ({
    date: p.trade_date,
    open: p.open != null ? p.open / scale : null,
    high: p.high != null ? p.high / scale : null,
    low: p.low != null ? p.low / scale : null,
    close: p.close != null ? p.close / scale : null,
    volume: p.volume,
    market_cap: p.market_cap,
    change_pct: 0,
  }));
}

// ─── consensus ───
export async function supaConsensus(code: string) {
  const [consRes, analystRes, priceRes] = await Promise.all([
    supabase.from('consensus').select('*').eq('ticker', code).single(),
    supabase.from('analyst_opinions').select('*').eq('ticker', code).order('date', { ascending: false }),
    supabase.from('daily_prices').select('close').eq('ticker', code).order('trade_date', { ascending: false }).limit(1).single(),
  ]);

  if (!consRes.data) return null;
  const c = consRes.data;
  const currentPrice = priceRes.data?.close || 0;
  const upside = currentPrice > 0 ? Math.round((c.target_price - currentPrice) / currentPrice * 1000) / 10 : null;

  return {
    code, rating: c.rating, targetPrice: c.target_price, targetPriceWeighted: c.target_price,
    consensusEps: c.consensus_eps, consensusPer: c.consensus_per,
    analystCount: c.analyst_count, recentCount: (analystRes.data || []).length,
    currentPrice, upside,
    analysts: (analystRes.data || []).map((a: Record<string, unknown>) => ({
      provider: a.provider, date: a.date, targetPrice: a.target_price,
      prevTargetPrice: a.prev_target_price, changePct: a.change_pct,
      opinion: a.opinion, prevOpinion: a.prev_opinion, weight: 1,
    })),
    disclaimer: '증권사 의견은 참고 자료이며 투자 판단의 책임은 본인에게 있습니다.',
  };
}

// ─── undervalued ───
export async function supaUndervalued(options: { mode?: string; limit?: number; tier?: string }) {
  const mode = options.mode || 'total';
  const limit = options.limit || 30;

  // analyst 모드: 별도 consensus 테이블 사용
  if (mode === 'analyst') {
    const { data: consensus } = await supabase
      .from('consensus')
      .select('ticker, rating, target_price, analyst_count, stocks!inner(name, market)')
      .gt('target_price', 0)
      .order('rating', { ascending: false })
      .limit(300);

    const tickers = (consensus || []).map(c => c.ticker);
    const pricesRes = tickers.length > 0
      ? await supabase.from('daily_prices').select('ticker, close, market_cap, trade_date')
          .in('ticker', tickers).order('trade_date', { ascending: false })
      : { data: [] };
    const latestPrice: Record<string, { close: number; market_cap: number }> = {};
    for (const p of pricesRes.data || []) {
      if (!latestPrice[p.ticker]) latestPrice[p.ticker] = { close: p.close, market_cap: p.market_cap };
    }

    let analystData = (consensus || []).map(c => {
      const stock = (c as Record<string, unknown>).stocks as { name: string; market: string };
      const px = latestPrice[c.ticker];
      const currentPrice = px?.close || 0;
      const targetPrice = c.target_price || 0;
      const upside = currentPrice > 0 ? Math.round((targetPrice - currentPrice) / currentPrice * 1000) / 10 : null;
      const mcap = px?.market_cap || 0;
      const tier = mcap >= 50000 ? '초대형주' : mcap >= 10000 ? '대형주' : mcap >= 3000 ? '중형주' : '소형주';
      return {
        code: c.ticker, name: stock.name, market: stock.market.toLowerCase(),
        price: currentPrice, changePct: 0, marketCap: mcap, tier,
        currentPrice, targetPriceWeighted: targetPrice, upside,
        rating: c.rating, analystCount: c.analyst_count,
        perTtm: null, porTtm: null, psrTtm: null,
        niChange: null, mcapChange: null, niGapRatio: null,
        turnaround: false, deficitTurn: false,
        uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null,
        ttmRevenue: 0, ttmNi: 0, ttmOp: 0,
        score: 0, verdict: 'hold',
      };
    });
    if (options.tier && options.tier !== 'all') analystData = analystData.filter(d => d.tier === options.tier);
    analystData.sort((a, b) => (b.upside ?? -999) - (a.upside ?? -999));
    return { mode, modeLabel: '전문가 매수의견', totalCount: analystData.length, data: analystData.slice(0, limit) };
  }

  // 나머지 모드: 큰 pool 받아서 모드별 정렬
  const pool = await supaScores({ ...options, sort: 'score', limit: 300 });

  let sorted = [...pool];
  switch (mode) {
    case 'gap':
      sorted.sort((a, b) => (b.niGapRatio ?? -9999) - (a.niGapRatio ?? -9999));
      break;
    case 'ttm':
      // PER 데이터 없음 → score 높고 저평가(niGapRatio>0)인 종목 우선
      sorted = sorted.filter(d => (d.niGapRatio ?? 0) > 0);
      sorted.sort((a, b) => (b.niGapRatio ?? 0) - (a.niGapRatio ?? 0));
      break;
    case 'composite':
      // 점수 + 괴리율 가중 합산 (저평가+고품질 프록시)
      sorted.sort((a, b) => {
        const sa = (a.score || 0) * 1.0 + (a.niGapRatio ?? 0) * 0.3;
        const sb = (b.score || 0) * 1.0 + (b.niGapRatio ?? 0) * 0.3;
        return sb - sa;
      });
      break;
    default: // total
      sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return {
    mode,
    modeLabel: { total: '종합 저평가', ttm: '지금 싼 종목', gap: '아직 덜 오른 종목', composite: '싸고 좋은 기업' }[mode] || mode,
    totalCount: sorted.length,
    data: sorted.slice(0, limit),
  };
}

// ─── signals ───
export async function supaSignals() {
  // Supabase에서 흑자전환 감지 (growth_metrics 기반)
  const { data: turnarounds } = await supabase.from('growth_metrics')
    .select('ticker, profit_status, net_income_growth, stocks!inner(name, market)')
    .eq('profit_status', '흑자전환').limit(50);

  return {
    turnaround: (turnarounds || []).map(t => {
      const stock = (t as Record<string, unknown>).stocks as { name: string; market: string };
      return { code: t.ticker, name: stock.name, market: stock.market, prevNi: 0, currNi: 0, prevPeriod: '', currPeriod: '' };
    }),
    turnaroundCount: turnarounds?.length || 0,
    volumeSpike: [], volumeSpikeCount: 0,
    gapChange: [], gapChangeCount: 0,
  };
}

// ─── market overview ───
export async function supaMarketOverview() {
  const [macroRes, seasonRes, stateRes] = await Promise.all([
    supabase.from('macro_snapshot').select('*').order('snapshot_date', { ascending: false }).limit(1).single(),
    supabase.from('seasonality_snapshot').select('*').order('snapshot_date', { ascending: false }).limit(1).single(),
    supabase.from('market_state').select('*').order('judge_date', { ascending: false }).limit(1).single(),
  ]);
  return { macro: macroRes.data, seasonality: seasonRes.data, marketState: stateRes.data };
}

// ─── market risk (캐시에서 읽기) ───
export async function supaMarketRisk() {
  const { data } = await supabase.from('market_risk_cache').select('data').eq('id', 'current').single();
  return data?.data || { kr: { total: { score: 0, status: 'N/A', label: '한국 종합' } }, us: { total: { score: 0, status: 'N/A', label: '미국 종합' } } };
}

// ─── risk history (캐시에서 읽기) ───
export async function supaRiskHistory(market: string, period: string) {
  const { data } = await supabase.from('market_risk_cache').select('data').eq('id', `history_${market}`).single();
  const history = (data?.data || []) as Array<{ date: string; risk: number }>;

  const daysMap: Record<string, number> = { '3m': 13, '6m': 26, '1y': 52, '3y': 156 };
  const maxPoints = daysMap[period] || 52;
  const sliced = history.slice(-maxPoints);

  return { market, period, data: sliced };
}

// ─── risk signals (캐시에서 읽기) ───
export async function supaRiskSignals(market: string) {
  const { data } = await supabase.from('market_risk_cache').select('data').eq('id', `signals_${market}`).single();
  return data?.data || { current: { risk: 0, date: '', cash_pct: 30, action: 'N/A' }, signals: [], totalSignals: 0 };
}

// ─── Stage 2 Breakout 신호 ───
export async function supaBreakout(options: { limit?: number; newOnly?: boolean; signalType?: string }) {
  const limit = options.limit || 50;
  const signalType = options.signalType || 'confluence';

  // 가장 최근 스캔 날짜
  const latestRes = await supabase
    .from('stage2_signals')
    .select('scan_date')
    .eq('signal_type', signalType)
    .order('scan_date', { ascending: false })
    .limit(1);
  const latest = latestRes.data?.[0]?.scan_date;
  if (!latest) {
    return { data: [], asOf: null, prevDate: null, newCount: 0, keptCount: 0, signalType };
  }

  // 이전 스캔 날짜 (같은 signal_type 기준)
  const prevRes = await supabase
    .from('stage2_signals')
    .select('scan_date')
    .eq('signal_type', signalType)
    .lt('scan_date', latest)
    .order('scan_date', { ascending: false })
    .limit(1);
  const prev = prevRes.data?.[0]?.scan_date || null;

  // 오늘 신호 종목 (signal_type 필터 적용)
  const todayRes = await supabase
    .from('stage2_signals')
    .select('ticker, score, box_pos, ma_diff, ma60_slope, vol_ratio, ret_4w, confirmed')
    .eq('scan_date', latest)
    .eq('signal_type', signalType)
    .order('score', { ascending: false })
    .limit(limit);

  const sigRows = (todayRes.data || []) as Array<{
    ticker: string; score: number; box_pos: number; ma_diff: number;
    ma60_slope: number; vol_ratio: number; ret_4w: number; confirmed: boolean;
  }>;

  const tickersOnly = sigRows.map(r => r.ticker);
  const stockRes = tickersOnly.length > 0 ? await supabase
    .from('stocks')
    .select('ticker, name, market')
    .in('ticker', tickersOnly) : { data: [] };
  const stockMap = new Map<string, { name: string; market: string }>(
    (stockRes.data || []).map(s => [s.ticker, { name: s.name, market: s.market }])
  );

  const todayRows = sigRows.map(r => ({
    ...r,
    stocks: stockMap.get(r.ticker) || { name: r.ticker, market: 'KOSPI' },
  }));

  // 어제 종목 set
  const prevCodes = new Set<string>();
  if (prev) {
    const prevSig = await supabase
      .from('stage2_signals')
      .select('ticker')
      .eq('scan_date', prev)
      .eq('signal_type', signalType);
    for (const r of prevSig.data || []) prevCodes.add(r.ticker);
  }

  // 가장 최근 시세 + stock_scores 시총 폴백
  const tickers = todayRows.map(r => r.ticker);
  const priceMap = new Map<string, { close: number; change_pct: number; market_cap: number | null }>();
  const scoreMcapMap = new Map<string, number>();
  if (tickers.length > 0) {
    const [priceRes, scoreRes] = await Promise.all([
      supabase.from('daily_prices')
        .select('ticker, close, market_cap, trade_date')
        .in('ticker', tickers)
        .order('trade_date', { ascending: false }),
      supabase.from('stock_scores')
        .select('ticker, market_cap, score_date')
        .in('ticker', tickers)
        .order('score_date', { ascending: false }),
    ]);
    for (const p of priceRes.data || []) {
      if (!priceMap.has(p.ticker)) {
        priceMap.set(p.ticker, { close: p.close, change_pct: 0, market_cap: p.market_cap });
      }
    }
    for (const s of scoreRes.data || []) {
      if (!scoreMcapMap.has(s.ticker) && s.market_cap) {
        scoreMcapMap.set(s.ticker, s.market_cap);
      }
    }
  }

  // 첫 발견일 — 종목별로 30일 이내 연속 신호의 가장 오래된 날짜
  const firstSeenMap = new Map<string, string>();
  for (const r of todayRows) {
    const histRes = await supabase
      .from('stage2_signals')
      .select('scan_date')
      .eq('ticker', r.ticker)
      .eq('signal_type', signalType)
      .order('scan_date', { ascending: false });
    const dates = (histRes.data || []).map(d => d.scan_date);
    let first = dates[0];
    for (let i = 1; i < dates.length; i++) {
      const dPrev = new Date(dates[i-1]);
      const dCurr = new Date(dates[i]);
      const gap = Math.abs((dPrev.getTime() - dCurr.getTime()) / 86400000);
      if (gap > 7) break;
      first = dates[i];
    }
    firstSeenMap.set(r.ticker, first);
  }

  const data = todayRows
    .map(r => ({
      code: r.ticker,
      name: r.stocks.name,
      market: r.stocks.market,
      score: r.score,
      boxPos: r.box_pos,
      maDiff: r.ma_diff,
      ma60Slope: r.ma60_slope,
      volRatio: r.vol_ratio,
      ret4w: r.ret_4w,
      confirmed: r.confirmed,
      isNew: !prevCodes.has(r.ticker),
      firstSeen: firstSeenMap.get(r.ticker) || latest,
      price: (() => {
        const p = priceMap.get(r.ticker)?.close;
        if (p == null) return null;
        // 미국 종목은 cents → USD
        return r.stocks.market === 'US' ? p / 100 : p;
      })(),
      changePct: priceMap.get(r.ticker)?.change_pct ?? null,
      marketCap: priceMap.get(r.ticker)?.market_cap ?? scoreMcapMap.get(r.ticker) ?? null,
    }))
    .filter(d => !options.newOnly || d.isNew);

  return {
    data,
    asOf: latest,
    prevDate: prev,
    newCount: data.filter(d => d.isNew).length,
    keptCount: data.filter(d => !d.isNew).length,
    signalType,
  };
}
