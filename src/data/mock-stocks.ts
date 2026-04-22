import { Stock, MarketRisk, SectorSummary } from '@/types/stock';

export const marketRisk: MarketRisk = {
  trend: 12,
  volatility: 8,
  supply: 6,
  event: 3,
  total: 29,
  level: 'moderate',
  guide: '선별 접근 — 저평가 종목 위주로 분할 매수 권장',
};

export const sectorSummaries: SectorSummary[] = [
  { name: '반도체', stockCount: 45, avgUndervalueIndex: 28.3, topStock: 'SK하이닉스', trend: 'up' },
  { name: '조선', stockCount: 12, avgUndervalueIndex: 42.1, topStock: 'HD한국조선해양', trend: 'up' },
  { name: '2차전지', stockCount: 23, avgUndervalueIndex: -15.2, topStock: 'LG에너지솔루션', trend: 'down' },
  { name: '제약/바이오', stockCount: 67, avgUndervalueIndex: 8.7, topStock: '삼성바이오로직스', trend: 'flat' },
  { name: '자동차', stockCount: 18, avgUndervalueIndex: 35.6, topStock: '현대차', trend: 'up' },
  { name: '방산', stockCount: 8, avgUndervalueIndex: -22.4, topStock: '한화에어로스페이스', trend: 'down' },
  { name: '건설', stockCount: 22, avgUndervalueIndex: 19.8, topStock: 'DL이앤씨', trend: 'flat' },
  { name: '금융', stockCount: 35, avgUndervalueIndex: 24.1, topStock: 'KB금융', trend: 'up' },
];

export const mockStocks: Stock[] = [
  {
    ticker: '000660',
    name: 'SK하이닉스',
    market: 'KOSPI',
    sector: '반도체',
    price: 238000,
    priceChange: 3.2,
    financials: {
      revenue: 66300000, revenueGrowth: 94.2,
      operatingProfit: 23500000, operatingProfitGrowth: 312.8,
      netIncome: 19800000, netIncomeGrowth: 287.5,
      marketCap: 173400000, marketCapGrowth: 45.3,
      roe: 28.4, per: 8.8, pbr: 2.1,
      debtRatio: 72, currentRatio: 185,
      operatingMargin: 35.4, netMargin: 29.9, eps: 27200,
      undervalueIndex: 242.2,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 36, technical: 24, macro: 14, seasonality: 7, total: 81 },
    verdict: {
      verdict: 'strong_buy', confidence: 82,
      reasons: ['순이익 287% 성장 대비 시총 반영 45%로 극심한 괴리', 'HBM 수요 폭발로 구조적 성장 지속', '현금흐름 건강하고 부채비율 안정적'],
      risks: ['미중 반도체 규제 확대 가능성', '메모리 가격 사이클 고점 우려'],
      invalidation: 'HBM 수주 취소 또는 메모리 가격 20% 이상 급락 시',
    },
    killZone: false,
  },
  {
    ticker: '005930',
    name: '삼성전자',
    market: 'KOSPI',
    sector: '반도체',
    price: 83200,
    priceChange: 1.1,
    financials: {
      revenue: 300000000, revenueGrowth: 18.5,
      operatingProfit: 35000000, operatingProfitGrowth: 72.3,
      netIncome: 28000000, netIncomeGrowth: 65.8,
      marketCap: 497000000, marketCapGrowth: 12.1,
      roe: 12.8, per: 17.7, pbr: 1.4,
      debtRatio: 45, currentRatio: 245,
      operatingMargin: 11.7, netMargin: 9.3, eps: 4700,
      undervalueIndex: 53.7,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 30, technical: 18, macro: 14, seasonality: 7, total: 69 },
    verdict: {
      verdict: 'buy', confidence: 68,
      reasons: ['순이익 66% 성장 대비 시총 12% 반영으로 저평가', '파운드리 회복 기대감', 'PBR 1.4배로 역사적 저점 구간'],
      risks: ['파운드리 수율 문제 지속', '중국 스마트폰 수요 불확실'],
      invalidation: '다음 분기 영업이익 컨센서스 20% 이상 하회 시',
    },
    killZone: false,
  },
  {
    ticker: '005380',
    name: '현대차',
    market: 'KOSPI',
    sector: '자동차',
    price: 274000,
    priceChange: -0.7,
    financials: {
      revenue: 170000000, revenueGrowth: 8.2,
      operatingProfit: 15800000, operatingProfitGrowth: 12.5,
      netIncome: 12500000, netIncomeGrowth: 15.3,
      marketCap: 58000000, marketCapGrowth: -8.2,
      roe: 14.2, per: 4.6, pbr: 0.5,
      debtRatio: 158, currentRatio: 112,
      operatingMargin: 9.3, netMargin: 7.4, eps: 59500,
      undervalueIndex: 23.5,
    },
    cashflow: { operating: '+', investing: '-', financing: '+', label: '공격적 성장', score: 3 },
    score: { fundamental: 28, technical: 16, macro: 14, seasonality: 7, total: 65 },
    verdict: {
      verdict: 'buy', confidence: 64,
      reasons: ['PER 4.6배, PBR 0.5배로 극심한 저평가', '순이익 15% 성장에도 시총 오히려 하락', '미국 공장 가동으로 관세 리스크 완화'],
      risks: ['전기차 전환 비용 증가', '글로벌 자동차 수요 둔화 가능성'],
      invalidation: '미국 관세 25% 이상 현실화 시',
    },
    killZone: false,
  },
  {
    ticker: '329180',
    name: 'HD한국조선해양',
    market: 'KOSPI',
    sector: '조선',
    price: 218000,
    priceChange: 2.8,
    financials: {
      revenue: 21500000, revenueGrowth: 25.3,
      operatingProfit: 1200000, operatingProfitGrowth: 185.7,
      netIncome: 890000, netIncomeGrowth: 220.4,
      marketCap: 15500000, marketCapGrowth: 68.2,
      roe: 18.9, per: 17.4, pbr: 3.2,
      debtRatio: 195, currentRatio: 98,
      operatingMargin: 5.6, netMargin: 4.1, eps: 12500,
      undervalueIndex: 152.2,
    },
    cashflow: { operating: '+', investing: '-', financing: '+', label: '공격적 성장', score: 3 },
    score: { fundamental: 32, technical: 26, macro: 14, seasonality: 7, total: 79 },
    verdict: {
      verdict: 'strong_buy', confidence: 76,
      reasons: ['순이익 220% 급성장, 15년 조선 호황 초입', '친환경 선박 교체 수요 구조적', 'LNG 운반선 기술 독점적 우위'],
      risks: ['부채비율 195%로 높은 편', '원자재 가격 상승 시 마진 압박'],
      invalidation: '신규 수주 3개월 연속 감소 시',
    },
    killZone: false,
  },
  {
    ticker: '105560',
    name: 'KB금융',
    market: 'KOSPI',
    sector: '금융',
    price: 92400,
    priceChange: 0.5,
    financials: {
      revenue: 14200000, revenueGrowth: 5.8,
      operatingProfit: 6100000, operatingProfitGrowth: 8.2,
      netIncome: 4800000, netIncomeGrowth: 12.1,
      marketCap: 36800000, marketCapGrowth: -2.5,
      roe: 10.8, per: 7.7, pbr: 0.6,
      debtRatio: 1420, currentRatio: 105,
      operatingMargin: 43.0, netMargin: 33.8, eps: 12000,
      undervalueIndex: 14.6,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 26, technical: 20, macro: 14, seasonality: 7, total: 67 },
    verdict: {
      verdict: 'buy', confidence: 65,
      reasons: ['PBR 0.6배 극심한 저평가, 밸류업 수혜', '배당수익률 5%+로 안정적', '순이익 12% 성장에도 시총 오히려 하락'],
      risks: ['금리 하락 시 NIM 축소', '가계부채 부실화 우려'],
      invalidation: '분기 충당금 전입액 전년 대비 50% 이상 증가 시',
    },
    killZone: false,
  },
  {
    ticker: '012330',
    name: '현대모비스',
    market: 'KOSPI',
    sector: '자동차',
    price: 268000,
    priceChange: -1.2,
    financials: {
      revenue: 58000000, revenueGrowth: 6.1,
      operatingProfit: 2800000, operatingProfitGrowth: -5.2,
      netIncome: 3200000, netIncomeGrowth: 8.4,
      marketCap: 25200000, marketCapGrowth: -12.3,
      roe: 8.5, per: 7.9, pbr: 0.6,
      debtRatio: 85, currentRatio: 142,
      operatingMargin: 4.8, netMargin: 5.5, eps: 33900,
      undervalueIndex: 20.7,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 22, technical: 14, macro: 14, seasonality: 7, total: 57 },
    verdict: {
      verdict: 'buy', confidence: 55,
      reasons: ['PBR 0.6배로 자산가치 대비 저평가', '현대차그룹 밸류업 수혜 기대', '안정적 현금흐름'],
      risks: ['영업이익 역성장 중', '전장 사업 수익성 불확실'],
      invalidation: '영업이익 2분기 연속 두 자릿수 감소 시',
    },
    killZone: false,
  },
  {
    ticker: '009150',
    name: '삼성전기',
    market: 'KOSPI',
    sector: '전자부품',
    price: 165000,
    priceChange: 1.8,
    financials: {
      revenue: 10200000, revenueGrowth: 22.4,
      operatingProfit: 980000, operatingProfitGrowth: 45.8,
      netIncome: 780000, netIncomeGrowth: 38.2,
      marketCap: 12300000, marketCapGrowth: 8.5,
      roe: 9.2, per: 15.8, pbr: 1.5,
      debtRatio: 38, currentRatio: 320,
      operatingMargin: 9.6, netMargin: 7.6, eps: 10400,
      undervalueIndex: 29.7,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 28, technical: 22, macro: 14, seasonality: 7, total: 71 },
    verdict: {
      verdict: 'buy', confidence: 70,
      reasons: ['MLCC 수요 회복으로 실적 턴어라운드', '순이익 38% 성장 대비 시총 반영 낮음', '부채비율 38%로 매우 건전'],
      risks: ['중국 MLCC 업체 저가 공세', 'IT 수요 사이클 변동성'],
      invalidation: 'MLCC 평균 판매가격 15% 이상 하락 시',
    },
    killZone: false,
  },
  {
    ticker: '035420',
    name: 'NAVER',
    market: 'KOSPI',
    sector: 'IT/플랫폼',
    price: 218000,
    priceChange: -0.3,
    financials: {
      revenue: 10600000, revenueGrowth: 12.8,
      operatingProfit: 1850000, operatingProfitGrowth: 28.3,
      netIncome: 1420000, netIncomeGrowth: 22.1,
      marketCap: 35700000, marketCapGrowth: 5.8,
      roe: 7.8, per: 25.1, pbr: 1.8,
      debtRatio: 62, currentRatio: 198,
      operatingMargin: 17.5, netMargin: 13.4, eps: 8700,
      undervalueIndex: 16.3,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 24, technical: 18, macro: 14, seasonality: 7, total: 63 },
    verdict: {
      verdict: 'buy', confidence: 60,
      reasons: ['AI 검색 + 커머스 시너지 기대', '영업이익 28% 성장으로 수익성 개선', '라인야후 리스크 정리 중'],
      risks: ['글로벌 AI 경쟁 심화', '일본 라인야후 지분 매각 불확실성'],
      invalidation: '광고 매출 2분기 연속 역성장 시',
    },
    killZone: false,
  },
  {
    ticker: '006800',
    name: '미래에셋증권',
    market: 'KOSPI',
    sector: '금융',
    price: 9850,
    priceChange: 2.1,
    financials: {
      revenue: 4200000, revenueGrowth: 15.2,
      operatingProfit: 820000, operatingProfitGrowth: 35.4,
      netIncome: 680000, netIncomeGrowth: 42.1,
      marketCap: 5800000, marketCapGrowth: 8.3,
      roe: 11.5, per: 8.5, pbr: 0.7,
      debtRatio: 580, currentRatio: 115,
      operatingMargin: 19.5, netMargin: 16.2, eps: 1160,
      undervalueIndex: 33.8,
    },
    cashflow: { operating: '+', investing: '-', financing: '+', label: '공격적 성장', score: 3 },
    score: { fundamental: 26, technical: 22, macro: 14, seasonality: 7, total: 69 },
    verdict: {
      verdict: 'buy', confidence: 66,
      reasons: ['순이익 42% 성장 대비 시총 8% 반영', 'PBR 0.7배 저평가 + 밸류업 수혜', '글로벌 자산 다각화 강점'],
      risks: ['시장 변동성 확대 시 트레이딩 손실 가능', '해외 부동산 투자 리스크'],
      invalidation: '해외 부동산 PF 관련 대규모 충당금 발생 시',
    },
    killZone: false,
  },
  {
    ticker: '042700',
    name: '한미반도체',
    market: 'KOSDAQ',
    sector: '반도체장비',
    price: 128000,
    priceChange: 4.5,
    financials: {
      revenue: 680000, revenueGrowth: 82.5,
      operatingProfit: 285000, operatingProfitGrowth: 145.2,
      netIncome: 235000, netIncomeGrowth: 132.8,
      marketCap: 7200000, marketCapGrowth: 55.2,
      roe: 32.5, per: 30.6, pbr: 9.8,
      debtRatio: 22, currentRatio: 450,
      operatingMargin: 41.9, netMargin: 34.6, eps: 4180,
      undervalueIndex: 77.6,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 34, technical: 26, macro: 14, seasonality: 7, total: 81 },
    verdict: {
      verdict: 'strong_buy', confidence: 78,
      reasons: ['HBM TC본더 독점적 지위, 순이익 133% 폭발 성장', '영업이익률 42%로 초고수익 구조', '부채비율 22%로 극도로 건전'],
      risks: ['PBR 9.8배로 밸류에이션 높음', 'SK하이닉스 의존도 과다'],
      invalidation: 'HBM 수요 피크아웃 확인 또는 경쟁사 진입 시',
    },
    killZone: false,
  },
  {
    ticker: '003490',
    name: '대한항공',
    market: 'KOSPI',
    sector: '항공',
    price: 26500,
    priceChange: 0.8,
    financials: {
      revenue: 19800000, revenueGrowth: 3.2,
      operatingProfit: 2100000, operatingProfitGrowth: -18.5,
      netIncome: 1500000, netIncomeGrowth: -25.3,
      marketCap: 11200000, marketCapGrowth: -5.1,
      roe: 15.2, per: 7.5, pbr: 1.1,
      debtRatio: 285, currentRatio: 72,
      operatingMargin: 10.6, netMargin: 7.6, eps: 3530,
      undervalueIndex: -20.2,
    },
    cashflow: { operating: '+', investing: '-', financing: '-', label: '건강한 성장', score: 5 },
    score: { fundamental: 18, technical: 12, macro: 14, seasonality: 7, total: 51 },
    verdict: {
      verdict: 'hold', confidence: 52,
      reasons: ['아시아나 합병 시너지 기대', 'ROE 15%로 양호', '유류비 안정화'],
      risks: ['순이익 25% 역성장', '부채비율 285%로 높음'],
      invalidation: '유가 배럴당 100달러 돌파 시',
    },
    killZone: false,
  },
  {
    ticker: '999999',
    name: '가상부실기업',
    market: 'KOSDAQ',
    sector: '바이오',
    price: 1250,
    priceChange: -8.5,
    financials: {
      revenue: 12000, revenueGrowth: -45.2,
      operatingProfit: -28000, operatingProfitGrowth: -180.0,
      netIncome: -35000, netIncomeGrowth: -220.0,
      marketCap: 85000, marketCapGrowth: -62.3,
      roe: -45.2, per: -2.4, pbr: 3.8,
      debtRatio: 520, currentRatio: 45,
      operatingMargin: -233.3, netMargin: -291.7, eps: -520,
      undervalueIndex: -157.7,
    },
    cashflow: { operating: '-', investing: '+', financing: '+', label: '생존 위기', score: 0 },
    score: { fundamental: 0, technical: 0, macro: 0, seasonality: 0, total: 0 },
    verdict: {
      verdict: 'strong_sell', confidence: 95,
      reasons: ['3년 연속 영업적자, 자본잠식 진행 중', '전환사채 반복 발행', '영업CF 지속 마이너스'],
      risks: ['상장폐지 가능성', '추가 자본잠식 확대'],
      invalidation: '-',
    },
    killZone: true,
    killReason: '자본잠식 + 영업CF 지속 마이너스 + CB 반복 발행',
  },
];

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'strong_buy': return '#22c55e';
    case 'buy': return '#4ade80';
    case 'hold': return '#facc15';
    case 'sell': return '#f97316';
    case 'strong_sell': return '#ef4444';
    default: return '#6b7280';
  }
}

export function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case 'strong_buy': return 'Strong Buy';
    case 'buy': return 'Buy';
    case 'hold': return 'Hold';
    case 'sell': return 'Sell';
    case 'strong_sell': return 'Strong Sell';
    default: return '-';
  }
}

export function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'moderate': return '#facc15';
    case 'high': return '#f97316';
    case 'very_high': return '#ef4444';
    default: return '#6b7280';
  }
}

export function getRiskLabel(level: string): string {
  switch (level) {
    case 'low': return '낮음';
    case 'moderate': return '보통';
    case 'high': return '높음';
    case 'very_high': return '매우 높음';
    default: return '-';
  }
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '조';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(0) + '억';
  return n.toLocaleString();
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}
