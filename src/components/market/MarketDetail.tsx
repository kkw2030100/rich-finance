'use client';

import { TrendingUp, TrendingDown, DollarSign, Globe, Zap } from 'lucide-react';

const macroIndicators = [
  { label: '한국은행 기준금리', value: '3.00%', change: '-0.25%', direction: 'down' as const, icon: DollarSign, desc: '금리 인하 중 — 유동성 확대 기대' },
  { label: 'KOSPI', value: '2,687', change: '+1.2%', direction: 'up' as const, icon: TrendingUp, desc: '20주 이평선 상회 유지' },
  { label: 'KOSDAQ', value: '842', change: '-0.3%', direction: 'down' as const, icon: TrendingDown, desc: '20주 이평선 근처 횡보' },
  { label: 'VIX', value: '18.2', change: '-2.1', direction: 'down' as const, icon: Zap, desc: '변동성 안정화 추세' },
  { label: '원/달러 환율', value: '1,345원', change: '-8원', direction: 'down' as const, icon: Globe, desc: '원화 강세, 수출기업 부담 경감' },
  { label: '장단기 금리차', value: '+0.35%p', change: '+0.12%p', direction: 'up' as const, icon: TrendingUp, desc: '정상 양의 스프레드 유지' },
];

const events = [
  { date: '4/24', event: 'FOMC 의사록 공개', impact: '높음', color: 'var(--accent-red)' },
  { date: '4/28', event: '삼성전자 1Q 잠정 실적', impact: '높음', color: 'var(--accent-red)' },
  { date: '5/02', event: '미국 고용지표', impact: '보통', color: 'var(--accent-yellow)' },
  { date: '5/08', event: '옵션만기일', impact: '보통', color: 'var(--accent-yellow)' },
];

export function MarketDetail() {
  return (
    <div className="space-y-4">
      {/* Macro Indicators */}
      <div>
        <h2 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>거시경제 지표</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {macroIndicators.map(ind => (
            <div key={ind.label} className="card-hover rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <ind.icon size={16} style={{ color: ind.direction === 'up' ? 'var(--accent-green)' : 'var(--accent-red)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{ind.label}</span>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{ind.value}</span>
                <span className="text-sm font-bold"
                  style={{ color: ind.direction === 'up' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {ind.change}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ind.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Events */}
      <div>
        <h2 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>주요 이벤트</h2>
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {events.map((ev, i) => (
            <div key={i} className="flex items-center px-4 py-3 gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <span className="text-sm font-bold w-12" style={{ color: 'var(--text-secondary)' }}>{ev.date}</span>
              <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{ev.event}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${ev.color}18`, color: ev.color }}>
                {ev.impact}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Guide */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>AI 시장 가이드</h2>
        <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            <strong style={{ color: 'var(--accent-blue)' }}>거시 환경:</strong> 한국은행이 금리 인하를 시작하면서 유동성이 확대되고 있습니다.
            역사적으로 금리 인하 초기에는 가치주와 성장주 모두에게 기회가 됩니다.
          </p>
          <p>
            <strong style={{ color: 'var(--accent-purple)' }}>계절성:</strong> 현재 4월은 핼러윈 효과의 천국 구간(11~4월)에 해당합니다.
            다만 5월부터는 지옥 구간 진입이므로 포지션 관리에 주의가 필요합니다.
          </p>
          <p>
            <strong style={{ color: 'var(--accent-yellow)' }}>전략:</strong> 시장 위험도가 &apos;보통&apos; 수준이므로 저평가 종목 위주로 선별 접근하되,
            추격 매수보다는 분할 매수가 안전합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
