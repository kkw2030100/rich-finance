'use client';

import { Shield, TrendingDown, Activity, Users, AlertTriangle } from 'lucide-react';
import { marketRisk } from '@/data/mock-stocks';

const axes = [
  { key: 'trend', label: '추세', max: 40, icon: TrendingDown, desc: '코스피/코스닥 20주 이평 하회' },
  { key: 'volatility', label: '변동성', max: 25, icon: Activity, desc: '최근 20일 변동성 평균 수준' },
  { key: 'supply', label: '수급', max: 20, icon: Users, desc: '외국인/기관 중립적 흐름' },
  { key: 'event', label: '이벤트', max: 15, icon: AlertTriangle, desc: '단기 주요 이벤트 제한적' },
] as const;

function getGaugeColor(score: number) {
  if (score <= 24) return '#22c55e';
  if (score <= 49) return '#facc15';
  if (score <= 74) return '#f97316';
  return '#ef4444';
}

function getGaugeLabel(score: number) {
  if (score <= 24) return '낮음';
  if (score <= 49) return '보통';
  if (score <= 74) return '높음';
  return '매우 높음';
}

export function MarketRiskCard() {
  const color = getGaugeColor(marketRisk.total);
  const pct = (marketRisk.total / 100) * 100;

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} style={{ color }} />
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>시장 위험도</h2>
      </div>

      {/* Gauge */}
      <div className="flex items-center gap-4 mb-5">
        <div className="text-4xl font-black" style={{ color }}>{marketRisk.total}</div>
        <div className="flex-1">
          <div className="h-3 rounded-full mb-1.5" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full score-bar transition-all" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>0 안전</span>
            <span style={{ color }}>{getGaugeLabel(marketRisk.total)}</span>
            <span>100 위험</span>
          </div>
        </div>
      </div>

      {/* Guide */}
      <div className="rounded-lg px-3 py-2 mb-4 text-sm" style={{ background: 'rgba(250,204,21,0.08)', color: 'var(--accent-yellow)' }}>
        {marketRisk.guide}
      </div>

      {/* Axes */}
      <div className="grid grid-cols-2 gap-3">
        {axes.map(({ key, label, max, icon: Icon, desc }) => {
          const val = marketRisk[key as keyof typeof marketRisk] as number;
          const axisPct = (val / max) * 100;
          return (
            <div key={key} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="ml-auto text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{val}/{max}</span>
              </div>
              <div className="h-1.5 rounded-full mb-1" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${axisPct}%`, background: getGaugeColor(axisPct) }} />
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
