// 네이버증권 크롤링 유틸리티
// 서버 전용 — API Route / Edge Function에서만 사용

const BASE = 'https://finance.naver.com';
const API_BASE = 'https://m.stock.naver.com/api';

interface NaverStockItem {
  ticker: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
  sector: string;
  close: number;
  marketCap: number;
  volume: number;
  tradingValue: number;
  foreignRatio: number;
}

interface NaverFinancials {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter: number;
  isEstimated: boolean;
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  roe: number | null;
  eps: number | null;
  per: number | null;
  pbr: number | null;
  debtRatio: number | null;
  operatingMargin: number | null;
}

// 시가총액 상위 종목 목록 (네이버증권 시가총액 페이지)
export async function fetchMarketCapList(
  market: 'KOSPI' | 'KOSDAQ',
  page: number = 1,
): Promise<NaverStockItem[]> {
  const sosok = market === 'KOSPI' ? 0 : 1;
  const url = `${BASE}/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RichgoBot/1.0)' },
  });
  const html = await res.text();

  const items: NaverStockItem[] = [];
  // 정규식으로 테이블 파싱 — <a href="/item/main.naver?code=XXXXXX">
  const rowRegex =
    /<a href="\/item\/main\.naver\?code=(\d{6})"[^>]*>([^<]+)<\/a>[\s\S]*?<td class="number">([\s\S]*?)<\/td>/g;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    items.push({
      ticker: match[1],
      name: match[2].trim(),
      market,
      sector: '',
      close: 0,
      marketCap: 0,
      volume: 0,
      tradingValue: 0,
      foreignRatio: 0,
    });
  }

  return items;
}

// 개별 종목 시세 (네이버 모바일 API — JSON 응답)
export async function fetchStockPrice(ticker: string) {
  const url = `${API_BASE}/stock/${ticker}/basic`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RichgoBot/1.0)',
      Referer: 'https://m.stock.naver.com',
    },
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    ticker,
    close: parseNumber(data.closePrice),
    open: parseNumber(data.openPrice),
    high: parseNumber(data.highPrice),
    low: parseNumber(data.lowPrice),
    volume: parseNumber(data.accumulatedTradingVolume),
    tradingValue: parseNumber(data.accumulatedTradingValue),
    marketCap: parseNumber(data.marketCap),
    shares: parseNumber(data.listedSharesCount),
    foreignRatio: parseFloat(data.foreignOwnershipRatio) || 0,
  };
}

// 개별 종목 재무제표 (navercomp wisereport HTML 파싱)
export async function fetchFinancials(ticker: string): Promise<NaverFinancials[]> {
  // 1단계: encparam 획득
  const pageUrl = `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${ticker}`;
  const pageRes = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  if (!pageRes.ok) return [];
  const pageHtml = await pageRes.text();

  const encMatch = pageHtml.match(/encparam\s*:\s*'([^']+)'/);
  if (!encMatch) return [];
  const enc = encMatch[1];

  // 2단계: 분기 재무 AJAX 호출
  const ajaxUrl = `https://navercomp.wisereport.co.kr/v2/company/ajax/cF1001.aspx?cmp_cd=${ticker}&fin_typ=0&freq_typ=Q&encparam=${enc}`;
  const ajaxRes = await fetch(ajaxUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Referer: pageUrl,
    },
  });
  if (!ajaxRes.ok) return [];
  const html = await ajaxRes.text();

  // 3단계: 헤더(기간) 파싱
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g);
  if (!rows) return [];

  const periods: { year: number; quarter: number; isEstimated: boolean }[] = [];
  const headerRow = rows.find((r) => r.includes('IFRS'));
  if (headerRow) {
    const thMatches = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
    for (const m of thMatches) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
      const periodMatch = text.match(/(\d{4})\/(\d{2})(\(E\))?/);
      if (periodMatch) {
        const year = parseInt(periodMatch[1]);
        const month = parseInt(periodMatch[2]);
        periods.push({
          year,
          quarter: Math.ceil(month / 3),
          isEstimated: !!periodMatch[3],
        });
      }
    }
  }

  if (periods.length === 0) return [];

  // 4단계: 각 항목 행 파싱
  const dataMap: Record<string, (number | null)[]> = {};
  const targetLabels = ['매출액', '영업이익', '당기순이익', 'ROE', '부채비율', 'EPS', '영업이익률'];

  for (const row of rows) {
    const thMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/);
    if (!thMatch) continue;
    const label = thMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    if (!targetLabels.includes(label)) continue;

    const tdMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    const vals = tdMatches.map((m) => {
      const v = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/,/g, '').trim();
      if (v === '' || v === 'N/A') return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    });
    dataMap[label] = vals;
  }

  // 5단계: NaverFinancials[] 조립
  const results: NaverFinancials[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    results.push({
      ticker,
      fiscalYear: p.year,
      fiscalQuarter: p.quarter,
      isEstimated: p.isEstimated,
      revenue: dataMap['매출액']?.[i] ?? null,
      operatingProfit: dataMap['영업이익']?.[i] ?? null,
      netIncome: dataMap['당기순이익']?.[i] ?? null,
      roe: dataMap['ROE']?.[i] ?? null,
      eps: dataMap['EPS']?.[i] ?? null,
      per: null,
      pbr: null,
      debtRatio: dataMap['부채비율']?.[i] ?? null,
      operatingMargin: dataMap['영업이익률']?.[i] ?? null,
    });
  }

  return results;
}

// 전종목 시가총액 리스트 (네이버 모바일 API — 더 안정적)
export async function fetchAllStocks(market: 'KOSPI' | 'KOSDAQ') {
  const sosok = market === 'KOSPI' ? 'KOSPI' : 'KOSDAQ';
  const url = `${API_BASE}/stocks/marketValue/${sosok}?page=1&pageSize=100`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RichgoBot/1.0)',
      Referer: 'https://m.stock.naver.com',
    },
  });

  if (!res.ok) return [];
  const data = await res.json();

  return (data?.stocks || []).map((s: Record<string, string>) => ({
    ticker: s.itemCode,
    name: s.stockName,
    market,
    sector: s.industryGroupKor || '',
    close: parseNumber(s.closePrice),
    marketCap: parseNumber(s.marketCap),
    volume: parseNumber(s.accumulatedTradingVolume),
  }));
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '');
    return parseInt(cleaned) || 0;
  }
  return 0;
}

function parseFinanceValue(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}
