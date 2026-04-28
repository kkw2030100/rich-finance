import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaScores } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

// PBR/ROE/부채비율 실시간 계산 (DART 기반 폴백)
function calcRealtimeMetrics(db: ReturnType<typeof getDb>, code: string, marketCap: number) {
  const dart = db.prepare(`
    SELECT total_assets, total_liabilities, total_equity, year
    FROM dart_financials
    WHERE code = ? AND total_equity IS NOT NULL AND total_equity > 0
    ORDER BY year DESC LIMIT 1
  `).get(code) as { total_assets: number; total_liabilities: number; total_equity: number; year: number } | undefined;

  if (!dart || !dart.total_equity || dart.total_equity <= 0) return null;

  const equity = dart.total_equity;  // 원 단위
  const mcapWon = marketCap * 100000000;  // 억원 → 원

  // PBR = 시총 / 자본
  const pbr = mcapWon > 0 ? Math.round(mcapWon / equity * 100) / 100 : null;

  // ROE = TTM 순이익 / 자본
  const ttmQuarters = db.prepare(`
    SELECT net_income FROM financials
    WHERE code = ? AND period_type = 'quarter' AND net_income IS NOT NULL
    ORDER BY period DESC LIMIT 4
  `).all(code) as Array<{ net_income: number }>;
  const ttmNi = ttmQuarters.reduce((s, q) => s + (q.net_income || 0), 0);
  const ttmNiWon = ttmNi * 100000000;
  const roe = equity > 0 ? Math.round(ttmNiWon / equity * 10000) / 100 : null;

  // 부채비율
  const debtRatio = dart.total_liabilities != null && equity > 0
    ? Math.round(dart.total_liabilities / equity * 10000) / 100 : null;

  return { pbr, roe, debtRatio };
}

// 시총 구간 분류
function getTier(mcap: number): string {
  if (mcap >= 50000) return '초대형주';
  if (mcap >= 10000) return '대형주';
  if (mcap >= 3000) return '중형주';
  return '소형주';
}

// 기간별 설정 (period param 명시 시 새 로직 사용)
// - unit: 'quarter' = 분기 단위 YoY 단일분기 비교 / 'annual' = 연간 데이터 비교
// - shift: quarter는 분기 shift, annual은 연도 shift
// - days: 시총 비교 기준일 (오늘 - days)
// period param 미지정 시 기존 TTM-vs-TTM 동작 유지 (스크리너 등 backward compat)
type Unit = 'quarter' | 'annual';
const PERIOD_CONFIG: Record<string, { unit: Unit; shift: number; days: number; label: string }> = {
  'q3m':   { unit: 'quarter', shift: 1, days: 91,   label: '3개월' },
  'q6m':   { unit: 'quarter', shift: 2, days: 182,  label: '6개월' },
  'q9m':   { unit: 'quarter', shift: 3, days: 273,  label: '9개월' },
  'q1y':   { unit: 'quarter', shift: 4, days: 365,  label: '1년' },
  'q1.5y': { unit: 'quarter', shift: 6, days: 547,  label: '1.5년' },
  'a1y':   { unit: 'annual',  shift: 1, days: 365,  label: '1년 (연도)' },
  'a2y':   { unit: 'annual',  shift: 2, days: 730,  label: '2년 (연도)' },
  'a3y':   { unit: 'annual',  shift: 3, days: 1095, label: '3년 (연도)' },
};

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const market = params.get('market') || 'all';
    const sort = params.get('sort') || 'undervalue';
    const tier = params.get('tier') || 'all';
    const limit = parseInt(params.get('limit') || '50');
    const periodKey = params.get('period');  // undefined = 기본 동작 (TTM-vs-TTM)
    const periodCfg = periodKey ? PERIOD_CONFIG[periodKey] : null;
    const useExplicitPeriod = !!periodCfg;

    // Supabase 폴백 (Vercel 배포 시 brain.db 없음)
    // 주의: Supabase는 1년 스냅샷만 지원 — period 무시 + opGrowth 없음
    if (!isLocalDb()) {
      const data = await supaScores({ market, tier, sort, limit });
      const supaPeriodInfo = {
        key: '1y', label: '1년', unit: 'quarter' as Unit, days: 365,
        from: '', to: new Date().toISOString().slice(0, 10),
      };
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        totalCount: data.length,
        distribution: {},
        tierCounts: {},
        engineScores: true,
        dataSource: 'supabase',
        periodInfo: supaPeriodInfo,
        data,
      }, {
        headers: {
          // Vercel edge cache 10분, 1시간까지 stale 허용
          'Cache-Control': 's-maxage=600, stale-while-revalidate=3600',
        },
      });
    }

    const db = getDb();

    // scores 테이블이 비어있으면 간이 스코어링, 있으면 엔진 결과 사용
    const scoreCount = (db.prepare('SELECT count(*) as cnt FROM scores').get() as { cnt: number }).cnt;
    const useEngineScores = scoreCount > 0;

    // 전종목 + 최신 시세 + 재무
    const stocks = db.prepare(`
      SELECT
        s.code, s.name, s.market,
        dp.close AS price, dp.change_pct, dp.market_cap,
        dp.date AS price_date
      FROM stocks s
      JOIN daily_prices dp ON s.code = dp.code
      WHERE dp.date = (SELECT MAX(date) FROM daily_prices WHERE code = s.code)
        ${market !== 'all' ? 'AND s.market = ?' : ''}
      ORDER BY dp.market_cap DESC
    `).all(...(market !== 'all' ? [market] : [])) as Array<{
      code: string; name: string; market: string;
      price: number; change_pct: number; market_cap: number; price_date: string;
    }>;

    // 엔진 scores 맵
    const scoresMap: Record<string, {
      total_score: number; verdict: string; confidence: number;
      layer1_score: number; layer2_score: number; layer3_score: number; layer4_score: number;
      reasons: string; risks: string;
    }> = {};

    if (useEngineScores) {
      const today = (db.prepare('SELECT MAX(date) as d FROM scores').get() as { d: string }).d;
      const scoreRows = db.prepare(`
        SELECT code, total_score, verdict, confidence,
               layer1_score, layer2_score, layer3_score, layer4_score,
               reasons, risks
        FROM scores WHERE date = ? AND layer0_pass = 1
      `).all(today);
      for (const r of scoreRows as Array<typeof scoresMap[string] & { code: string }>) {
        scoresMap[r.code] = r;
      }
    }

    // 명시적 period 사용 시 cutoff 날짜 미리 계산
    const cutoffDateStr = useExplicitPeriod ? (() => {
      const d = new Date();
      d.setDate(d.getDate() - periodCfg!.days);
      return d.toISOString().slice(0, 10);
    })() : '';
    // 분기 데이터 limit: 기본 8 (TTM-vs-TTM), explicit quarter는 shift+1, annual은 8 충분
    const quartersLimit = useExplicitPeriod && periodCfg!.unit === 'quarter'
      ? Math.max(8, periodCfg!.shift + 1)
      : 8;

    const results = stocks.map(stock => {
      const quarters = db.prepare(`
        SELECT * FROM financials
        WHERE code = ? AND period_type = 'quarter'
        ORDER BY period DESC LIMIT ?
      `).all(stock.code, quartersLimit) as Array<{
        period: string; revenue: number; operating_profit: number; net_income: number;
        op_margin: number | null; roe: number | null; debt_ratio: number | null;
        per: number | null; pbr: number | null; is_estimate: number;
      }>;

      // 미국 종목: 재무 데이터 없으므로 시세 정보만
      if (stock.market === 'us') {
        return {
          code: stock.code, name: stock.name, market: stock.market,
          price: stock.price, changePct: stock.change_pct,
          marketCap: stock.market_cap || 0,
          tier: '미국주식', priceDate: stock.price_date,
          perTtm: null, roe: null, pbr: null, debtRatio: null, opMargin: null,
          uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null,
          niChange: null, opChange: null, mcapChange: null, niGapRatio: null,
          turnaround: false, deficitTurn: false,
          niGrowth: null, opGrowth: null, mcapGrowth: null, undervalueIndex: null,
          ttmRevenue: 0, ttmNetIncome: 0, ttmOp: 0,
          score: 0, verdict: 'na', confidence: 0, reasons: [], risks: [],
        };
      }

      if (quarters.length < 2) return null;

      // TTM (4분기 있으면 TTM, 아니면 있는 만큼)
      const ttmCount = Math.min(quarters.length, 4);
      const recent = quarters.slice(0, ttmCount);
      const ttmRevenue = recent.reduce((s, q) => s + (q.revenue || 0), 0);
      const ttmNetIncome = recent.reduce((s, q) => s + (q.net_income || 0), 0);
      const ttmOp = recent.reduce((s, q) => s + (q.operating_profit || 0), 0);
      const perTtm = ttmNetIncome > 0 ? stock.market_cap / ttmNetIncome : null;

      // === 증감액 기반 괴리 계산 (BACKEND_HANDOFF v2) ===
      // 핵심: (순이익 증감액 × 적정PER) - 시총 증감액 = 괴리
      // 적정PER 10배 가정
      const FAIR_PER = 10;

      let niChange: number | null = null;     // 순이익 증감액 (억원)
      let opChange: number | null = null;     // 영업이익 증감액 (억원)
      let mcapChange: number | null = null;   // 시총 증감액 (억원)
      let niGapRatio: number | null = null;   // 시총 대비 괴리 비율 (%)
      let turnaround = false;                 // 흑자전환
      let deficitTurn = false;                // 적자전환

      // 시총 증감액 (기간 전 대비)
      // 기본 (period 미지정): 가장 오래된 기록 (≈1년 전, 기존 동작)
      // 명시적 period: cutoff 날짜 기준
      const periodAgoPrice = useExplicitPeriod
        ? db.prepare(`
            SELECT market_cap FROM daily_prices
            WHERE code = ? AND market_cap > 0 AND date <= ?
            ORDER BY date DESC LIMIT 1
          `).get(stock.code, cutoffDateStr) as { market_cap: number } | undefined
        : db.prepare(`
            SELECT market_cap FROM daily_prices
            WHERE code = ? AND market_cap > 0
            ORDER BY date ASC LIMIT 1
          `).get(stock.code) as { market_cap: number } | undefined;

      if (periodAgoPrice && periodAgoPrice.market_cap > 0) {
        mcapChange = stock.market_cap - periodAgoPrice.market_cap;
      }

      // 순이익/영업이익 증감액
      // 1) 명시적 period + annual: 연간 보고서 비교 (shift년 차이 검증)
      // 2) 명시적 period + quarter: YoY 단일분기 비교 (Q[0] vs Q[shift])
      // 3) 기본: TTM-vs-TTM (8Q 윈도우, 기존 동작)
      let prevNiForGrowth = 0;  // niGrowth 계산용
      let prevOpForGrowth = 0;  // opGrowth 계산용

      if (useExplicitPeriod && periodCfg!.unit === 'annual') {
        // 연도 단위: 가장 최근 annual의 연도(X)와 X-shift년 record를 명시적 매칭
        // 추정치(E)도 포함 — 2026.12(E) vs 2023.12 같은 비교가 KOSPI에서 가장 흔함
        const annuals = db.prepare(`
          SELECT period, net_income, operating_profit FROM financials
          WHERE code = ? AND period_type = 'annual'
          ORDER BY period DESC
        `).all(stock.code) as Array<{ period: string; net_income: number; operating_profit: number }>;
        if (annuals.length >= 2) {
          const recentA = annuals[0];
          const recentYear = parseInt(recentA.period.slice(0, 4));
          const targetYear = recentYear - periodCfg!.shift;
          const prevA = annuals.find(a => parseInt(a.period.slice(0, 4)) === targetYear);
          if (prevA) {
            niChange = (recentA.net_income || 0) - (prevA.net_income || 0);
            opChange = (recentA.operating_profit || 0) - (prevA.operating_profit || 0);
            prevNiForGrowth = prevA.net_income || 0;
            prevOpForGrowth = prevA.operating_profit || 0;
            if ((prevA.net_income || 0) <= 0 && (recentA.net_income || 0) > 0) turnaround = true;
            if ((prevA.net_income || 0) > 0 && (recentA.net_income || 0) <= 0) deficitTurn = true;
          }
        }
      } else if (useExplicitPeriod && periodCfg!.unit === 'quarter') {
        // 분기 YoY 단일분기: Q[0] vs Q[shift] (전년 동기 대비 스타일)
        const sh = periodCfg!.shift;
        if (quarters.length > sh) {
          const recentQ = quarters[0];
          const prevQ = quarters[sh];
          niChange = (recentQ.net_income || 0) - (prevQ.net_income || 0);
          opChange = (recentQ.operating_profit || 0) - (prevQ.operating_profit || 0);
          prevNiForGrowth = prevQ.net_income || 0;
          prevOpForGrowth = prevQ.operating_profit || 0;
          if ((prevQ.net_income || 0) <= 0 && (recentQ.net_income || 0) > 0) turnaround = true;
          if ((prevQ.net_income || 0) > 0 && (recentQ.net_income || 0) <= 0) deficitTurn = true;
        }
      } else if (quarters.length >= 8) {
        // 기본: TTM-vs-TTM (기존 동작)
        const recentNi = quarters.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0);
        const prevNi = quarters.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);
        niChange = recentNi - prevNi;
        const recentOp = quarters.slice(0, 4).reduce((s, q) => s + (q.operating_profit || 0), 0);
        const prevOp = quarters.slice(4, 8).reduce((s, q) => s + (q.operating_profit || 0), 0);
        opChange = recentOp - prevOp;
        prevNiForGrowth = prevNi;
        prevOpForGrowth = prevOp;
        if (prevNi <= 0 && recentNi > 0) turnaround = true;
        if (prevNi > 0 && recentNi <= 0) deficitTurn = true;
      } else if (quarters.length >= 2) {
        // QoQ 폴백
        const curr = quarters[0];
        const prev = quarters[1];
        niChange = (curr.net_income || 0) - (prev.net_income || 0);
        opChange = (curr.operating_profit || 0) - (prev.operating_profit || 0);
        prevNiForGrowth = prev.net_income || 0;
        prevOpForGrowth = prev.operating_profit || 0;

        if ((prev.net_income || 0) <= 0 && (curr.net_income || 0) > 0) turnaround = true;
        if ((prev.net_income || 0) > 0 && (curr.net_income || 0) <= 0) deficitTurn = true;

        // 시총 증감도 같은 기간으로 폴백
        if (mcapChange === null) {
          const prevPeriod = prev.period.replace('(E)', '').trim();
          const [py, pm] = prevPeriod.split('.');
          if (py && pm) {
            const prevEnd = new Date(parseInt(py), parseInt(pm), 0).toISOString().slice(0, 10);
            const prevMcap = db.prepare(`
              SELECT market_cap FROM daily_prices
              WHERE code = ? AND market_cap > 0 AND date <= ?
              ORDER BY date DESC LIMIT 1
            `).get(stock.code, prevEnd) as { market_cap: number } | undefined;
            if (prevMcap && prevMcap.market_cap > 0) {
              mcapChange = stock.market_cap - prevMcap.market_cap;
            }
          }
        }
      }

      // 괴리 계산: (순이익 증감액 × 적정PER) - 시총 증감액
      let niGap: number | null = null;
      if (niChange !== null && mcapChange !== null) {
        niGap = (niChange * FAIR_PER) - mcapChange;
        if (stock.market_cap > 0) {
          niGapRatio = (niGap / stock.market_cap) * 100;
        }
      }

      // 증감율 (위에서 계산한 niChange/prevNiForGrowth로부터 도출)
      let niGrowth: number | null = null;
      let opGrowth: number | null = null;
      let mcapGrowth: number | null = null;
      if (periodAgoPrice && periodAgoPrice.market_cap > 0) {
        mcapGrowth = ((stock.market_cap - periodAgoPrice.market_cap) / periodAgoPrice.market_cap) * 100;
      }
      if (niChange !== null && prevNiForGrowth !== 0) {
        niGrowth = (niChange / Math.abs(prevNiForGrowth)) * 100;
      }
      if (opChange !== null && prevOpForGrowth !== 0) {
        opGrowth = (opChange / Math.abs(prevOpForGrowth)) * 100;
      }
      const undervalueIndex = niGapRatio;

      // 엔진 스코어 or 간이 스코어
      const eng = scoresMap[stock.code];
      let score: number;
      let verdict: string;
      let confidence: number;
      let reasons: string[] = [];
      let risks: string[] = [];

      if (eng) {
        score = eng.total_score;
        verdict = eng.verdict.toLowerCase().replace(/\s+/g, '_');
        confidence = eng.confidence;
        try { reasons = JSON.parse(eng.reasons || '[]'); } catch { reasons = []; }
        try { risks = JSON.parse(eng.risks || '[]'); } catch { risks = []; }
      } else {
        score = 50;
        if (perTtm !== null && perTtm > 0 && perTtm < 10) score += 10;
        if (quarters[0].roe && quarters[0].roe > 15) score += 8;
        if (undervalueIndex !== null && undervalueIndex > 50) score += 8;
        score = Math.min(score, 100);
        verdict = score >= 75 ? 'strong_buy' : score >= 60 ? 'buy' : score <= 25 ? 'strong_sell' : score <= 40 ? 'sell' : 'hold';
        confidence = 50;
      }

      const stockTier = getTier(stock.market_cap);

      return {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        price: stock.price,
        changePct: stock.change_pct,
        marketCap: stock.market_cap,
        tier: stockTier,
        priceDate: stock.price_date,
        perTtm: perTtm ? Math.round(perTtm * 10) / 10 : null,
        // PBR/ROE/부채비율: 네이버 값 → null이면 DART 실시간 계산 폴백
        ...(() => {
          const naver = { roe: quarters[0].roe, pbr: quarters[0].pbr, debtRatio: quarters[0].debt_ratio };
          if (naver.roe != null && naver.pbr != null && naver.debtRatio != null) return naver;
          const rt = calcRealtimeMetrics(db, stock.code, stock.market_cap);
          return {
            roe: naver.roe ?? rt?.roe ?? null,
            pbr: naver.pbr ?? rt?.pbr ?? null,
            debtRatio: naver.debtRatio ?? rt?.debtRatio ?? null,
          };
        })(),
        opMargin: quarters[0].op_margin,
        // 복합인덱스 (DART)
        ...(() => {
          const dart = db.prepare(`
            SELECT gpa, fcf FROM dart_financials WHERE code = ? ORDER BY year DESC LIMIT 1
          `).get(stock.code) as { gpa: number; fcf: number } | undefined;
          if (!dart) return { uiValue: null, uiQuality: null, uiIndex: null, uiQuadrant: null };
          const valueScore = (perTtm && perTtm > 0 && perTtm < 50) ? Math.max(0, 50 - perTtm) : 0;
          const qualityScore = (dart.gpa || 0) * 100 + ((dart.fcf || 0) > 0 ? 20 : 0);
          const medV = 25, medQ = 30;
          let quad: string;
          if (valueScore >= medV && qualityScore >= medQ) quad = '저평가+고품질';
          else if (valueScore >= medV) quad = '저평가+저품질';
          else if (qualityScore >= medQ) quad = '고평가+고품질';
          else quad = '고평가+저품질';
          return {
            uiValue: Math.round(Math.min(valueScore * 2, 100)),
            uiQuality: Math.round(Math.min(qualityScore, 100)),
            uiIndex: Math.round(valueScore + qualityScore),
            uiQuadrant: quad,
          };
        })(),
        // 증감액 기반 (v2)
        niChange,
        opChange,
        mcapChange,
        niGapRatio: niGapRatio ? Math.round(niGapRatio * 10) / 10 : null,
        turnaround,
        deficitTurn,
        // 하위 호환 (증감율 기반)
        niGrowth: niGrowth ? Math.round(niGrowth * 10) / 10 : null,
        opGrowth: opGrowth ? Math.round(opGrowth * 10) / 10 : null,
        mcapGrowth: mcapGrowth ? Math.round(mcapGrowth * 10) / 10 : null,
        undervalueIndex: undervalueIndex ? Math.round(undervalueIndex * 10) / 10 : null,
        ttmRevenue,
        ttmNetIncome,
        ttmOp,
        score,
        verdict,
        confidence,
        reasons,
        risks,
      };
    }).filter(Boolean);

    // Tier 필터
    let filtered = results;
    if (tier !== 'all') {
      filtered = results.filter(r => r && r.tier === tier);
    }

    // 구간 내 분포 기반 판정 (tier_verdict)
    if (tier !== 'all' && useEngineScores) {
      const sorted = [...filtered].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
      const n = sorted.length;
      for (let i = 0; i < n; i++) {
        const pct = i / n * 100;
        const item = sorted[i];
        if (!item) continue;
        if (pct <= 5) item.verdict = 'strong_buy';
        else if (pct <= 20) item.verdict = 'buy';
        else if (pct <= 80) item.verdict = 'hold';
        else if (pct <= 95) item.verdict = 'sell';
        else item.verdict = 'strong_sell';
      }
    }

    // Sort
    const sorted = filtered.sort((a, b) => {
      if (!a || !b) return 0;
      switch (sort) {
        case 'score': return b.score - a.score;
        case 'undervalue': return (b.undervalueIndex ?? -9999) - (a.undervalueIndex ?? -9999);
        case 'per': return (a.perTtm ?? 9999) - (b.perTtm ?? 9999);
        case 'marketCap': return b.marketCap - a.marketCap;
        default: return (b.undervalueIndex ?? -9999) - (a.undervalueIndex ?? -9999);
      }
    }).slice(0, limit);

    // Distribution
    const dist = { strong_buy: 0, buy: 0, hold: 0, sell: 0, strong_sell: 0 };
    filtered.forEach(r => { if (r) dist[r.verdict as keyof typeof dist]++; });

    // Tier counts
    const tierCounts = { '초대형주': 0, '대형주': 0, '중형주': 0, '소형주': 0 };
    results.forEach(r => { if (r) tierCounts[r.tier as keyof typeof tierCounts]++; });

    // 기간 메타 (UI 라벨용)
    const today = new Date();
    const days = useExplicitPeriod ? periodCfg!.days : 365;
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - days);
    const periodInfo = {
      key: periodKey || '1y_default',
      label: useExplicitPeriod ? periodCfg!.label : '1년',
      unit: useExplicitPeriod ? periodCfg!.unit : ('quarter' as Unit),
      days,
      from: fromDate.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalCount: filtered.length,
      distribution: dist,
      tierCounts,
      engineScores: useEngineScores,
      dataSource: 'local',
      periodInfo,
      data: sorted,
    });
  } catch (error) {
    console.error('Scores API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
