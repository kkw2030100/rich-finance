// 포맷 유틸 — mock-stocks.ts에서 분리

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
