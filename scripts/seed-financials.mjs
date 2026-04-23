// 재무제표만 재수집하는 스크립트
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchFinancials(ticker) {
  const pageUrl = `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${ticker}`;
  const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
  if (!pageRes.ok) return [];
  const pageHtml = await pageRes.text();
  const encMatch = pageHtml.match(/encparam\s*:\s*'([^']+)'/);
  if (!encMatch) return [];

  const ajaxUrl = `https://navercomp.wisereport.co.kr/v2/company/ajax/cF1001.aspx?cmp_cd=${ticker}&fin_typ=0&freq_typ=Q&encparam=${encMatch[1]}`;
  const ajaxRes = await fetch(ajaxUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: pageUrl }
  });
  if (!ajaxRes.ok) return [];
  const html = await ajaxRes.text();

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

  return periods.map((p, i) => ({
    ticker, fiscal_year: p.year, fiscal_quarter: p.quarter, is_estimated: p.isEstimated,
    revenue: dataMap['매출액']?.[i] ?? null,
    operating_profit: dataMap['영업이익']?.[i] ?? null,
    net_income: dataMap['당기순이익']?.[i] ?? null,
    roe: dataMap['ROE']?.[i] ?? null,
    eps: dataMap['EPS']?.[i] ?? null,
    debt_ratio: dataMap['부채비율']?.[i] ?? null,
    operating_margin: dataMap['영업이익률']?.[i] ?? null,
  }));
}

async function main() {
  console.log('=== 재무제표 수집 시작 ===');

  const { data: stocks } = await supabase
    .from('stocks').select('ticker').eq('is_active', true);

  if (!stocks) { console.error('No stocks'); return; }
  console.log(`총 ${stocks.length}개 종목`);

  let ok = 0, fail = 0;
  for (let i = 0; i < stocks.length; i += 3) {
    const batch = stocks.slice(i, i + 3);
    const results = await Promise.allSettled(batch.map(async ({ ticker }) => {
      const fins = await fetchFinancials(ticker);
      if (fins.length === 0) return null;
      const { error } = await supabase.from('quarterly_financials')
        .upsert(fins, { onConflict: 'ticker,fiscal_year,fiscal_quarter' });
      if (error) throw error;
      return fins.length;
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) ok++;
      else fail++;
    }

    if (i % 30 === 0) console.log(`  진행: ${i}/${stocks.length} (OK: ${ok}, Fail: ${fail})`);
    await sleep(500);
  }
  console.log(`\n=== 완료: OK ${ok}, Fail ${fail} ===`);
}

main().catch(console.error);
