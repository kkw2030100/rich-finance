// 종목 마스터 + 시세 + 재무제표 초기 적재 스크립트
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'https://m.stock.naver.com/api';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; RichgoBot/1.0)',
  Referer: 'https://m.stock.naver.com',
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val.replace(/,/g, '')) || 0;
  return 0;
}

async function fetchStockList(market, page = 1, pageSize = 100) {
  const url = `${API_BASE}/stocks/marketValue/${market}?page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.stocks || []).map(s => ({
    ticker: s.itemCode,
    name: s.stockName,
    market,
    sector: s.industryGroupKor || null,
    close: parseNum(s.closePrice),
    marketCap: parseNum(s.marketCap),
    volume: parseNum(s.accumulatedTradingVolume),
    tradingValue: parseNum(s.accumulatedTradingValue),
  }));
}

async function fetchStockPrice(ticker) {
  const url = `${API_BASE}/stock/${ticker}/basic`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const d = await res.json();
  return {
    close: parseNum(d.closePrice),
    open: parseNum(d.openPrice),
    high: parseNum(d.highPrice),
    low: parseNum(d.lowPrice),
    volume: parseNum(d.accumulatedTradingVolume),
    tradingValue: parseNum(d.accumulatedTradingValue),
    marketCap: parseNum(d.marketCap),
    shares: parseNum(d.listedSharesCount),
    foreignRatio: parseFloat(d.foreignOwnershipRatio) || 0,
  };
}

async function fetchFinancials(ticker) {
  // 1단계: encparam 획득
  const pageUrl = `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${ticker}`;
  const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
  if (!pageRes.ok) return [];
  const pageHtml = await pageRes.text();
  const encMatch = pageHtml.match(/encparam\s*:\s*'([^']+)'/);
  if (!encMatch) return [];

  // 2단계: 분기 재무 AJAX
  const ajaxUrl = `https://navercomp.wisereport.co.kr/v2/company/ajax/cF1001.aspx?cmp_cd=${ticker}&fin_typ=0&freq_typ=Q&encparam=${encMatch[1]}`;
  const ajaxRes = await fetch(ajaxUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: pageUrl }
  });
  if (!ajaxRes.ok) return [];
  const html = await ajaxRes.text();

  // 3단계: 헤더(기간) 파싱
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g);
  if (!rows) return [];

  const periods = [];
  const headerRow = rows.find(r => r.includes('IFRS'));
  if (headerRow) {
    const thMatches = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
    for (const m of thMatches) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '');
      const pm = text.match(/(\d{4})\/(\d{2})(\(E\))?/);
      if (pm) periods.push({ year: parseInt(pm[1]), quarter: Math.ceil(parseInt(pm[2]) / 3), isEstimated: !!pm[3] });
    }
  }
  if (periods.length === 0) return [];

  // 4단계: 항목별 데이터 파싱
  const dataMap = {};
  const targets = ['매출액', '영업이익', '당기순이익', 'ROE', '부채비율', 'EPS', '영업이익률'];
  for (const row of rows) {
    const thMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/);
    if (!thMatch) continue;
    const label = thMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    if (!targets.includes(label)) continue;
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    dataMap[label] = tds.map(m => {
      const v = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/,/g, '').trim();
      if (v === '' || v === 'N/A') return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    });
  }

  // 5단계: 결과 조립
  return periods.map((p, i) => ({
    ticker, fiscal_year: p.year, fiscal_quarter: p.quarter, is_estimated: p.isEstimated,
    revenue: dataMap['매출액']?.[i] ?? null,
    operating_profit: dataMap['영업이익']?.[i] ?? null,
    net_income: dataMap['당기순이익']?.[i] ?? null,
    roe: dataMap['ROE']?.[i] ?? null,
    eps: dataMap['EPS']?.[i] ?? null,
    per: null, pbr: null,
    debt_ratio: dataMap['부채비율']?.[i] ?? null,
    operating_margin: dataMap['영업이익률']?.[i] ?? null,
  }));
}

function parseFinVal(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`=== 시작: ${today} ===`);

  // 1. 종목 마스터 수집
  console.log('\n[1/3] 종목 마스터 수집...');
  const allStocks = [];
  for (const market of ['KOSPI', 'KOSDAQ']) {
    for (let page = 1; page <= 3; page++) {
      const stocks = await fetchStockList(market, page);
      if (stocks.length === 0) break;
      allStocks.push(...stocks);
      console.log(`  ${market} page ${page}: ${stocks.length}개`);
      await sleep(200);
    }
  }

  // stocks 테이블 upsert
  const stockRows = allStocks.map(s => ({
    ticker: s.ticker, name: s.name, market: s.market,
    sector: s.sector, is_active: true, updated_at: new Date().toISOString(),
  }));

  const { error: stockErr } = await supabase
    .from('stocks')
    .upsert(stockRows, { onConflict: 'ticker' });

  if (stockErr) { console.error('stocks upsert failed:', stockErr); return; }
  console.log(`  => ${stockRows.length}개 종목 저장 완료`);

  // 2. 시세 수집 (배치 10개씩)
  console.log('\n[2/3] 시세 수집...');
  let priceOk = 0, priceFail = 0;
  for (let i = 0; i < allStocks.length; i += 10) {
    const batch = allStocks.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(async (s) => {
      const p = await fetchStockPrice(s.ticker);
      if (!p || !p.close) return null;
      return {
        ticker: s.ticker, trade_date: today,
        open: p.open, high: p.high, low: p.low, close: p.close,
        volume: p.volume, trading_value: p.tradingValue,
        market_cap: p.marketCap, shares: p.shares, foreign_ratio: p.foreignRatio,
      };
    }));

    const rows = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    if (rows.length > 0) {
      const { error } = await supabase.from('daily_prices').upsert(rows, { onConflict: 'ticker,trade_date' });
      if (error) { console.error(`  prices batch ${i} error:`, error.message); priceFail += rows.length; }
      else priceOk += rows.length;
    }
    priceFail += results.filter(r => r.status !== 'fulfilled' || !r.value).length;

    if (i % 50 === 0) console.log(`  진행: ${i}/${allStocks.length} (OK: ${priceOk}, Fail: ${priceFail})`);
    await sleep(300);
  }
  console.log(`  => 시세 완료: OK ${priceOk}, Fail ${priceFail}`);

  // 3. 재무제표 수집 (배치 5개씩)
  console.log('\n[3/3] 재무제표 수집...');
  let finOk = 0, finFail = 0;
  for (let i = 0; i < allStocks.length; i += 5) {
    const batch = allStocks.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(async (s) => {
      const fins = await fetchFinancials(s.ticker);
      if (fins.length === 0) return null;
      const { error } = await supabase.from('quarterly_financials')
        .upsert(fins, { onConflict: 'ticker,fiscal_year,fiscal_quarter' });
      if (error) throw error;
      return fins.length;
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) finOk++;
      else finFail++;
    }

    if (i % 50 === 0) console.log(`  진행: ${i}/${allStocks.length} (OK: ${finOk}, Fail: ${finFail})`);
    await sleep(400);
  }
  console.log(`  => 재무 완료: OK ${finOk}, Fail ${finFail}`);

  console.log('\n=== 완료 ===');
}

main().catch(console.error);
