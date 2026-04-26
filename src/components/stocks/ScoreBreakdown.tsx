'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, Activity, Users, Zap, DollarSign } from 'lucide-react';

interface ScoreData {
  date: string;
  total: number;
  l1: number; l2: number; l3: number;
  l4: number; l5: number; l6: number;
}

const LAYERS = [
  { key: 'l1', label: '재무', max: 50, icon: DollarSign, weight: '50%', kor: 'PER, ROE, 성장' },
  { key: 'l2', label: '기술', max: 15, icon: TrendingUp, weight: '15%', kor: '추세, 모멘텀' },
  { key: 'l5', label: '컨센서스', max: 15, icon: Users, weight: '15%', kor: '애널리스트' },
  { key: 'l4', label: '수급', max: 10, icon: BarChart3, weight: '10%', kor: '거래량, 외인기관' },
  { key: 'l3', label: '시장', max: 5, icon: Activity, weight: '5%', kor: '시장 위험도' },
  { key: 'l6', label: '모멘텀', max: 5, icon: Zap, weight: '5%', kor: '1m/3m 수익률' },
] as const;

type LayerKey = 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6';

function getStrengthLabel(pct: number) {
  if (pct >= 80) return { label: '매우 우수', color: '#22c55e' };
  if (pct >= 60) return { label: '우수', color: '#84cc16' };
  if (pct >= 40) return { label: '평균', color: '#facc15' };
  if (pct >= 20) return { label: '약함', color: '#f97316' };
  return { label: '매우 약함', color: '#ef4444' };
}

export function ScoreBreakdown({ code, totalScore }: { code: string; totalScore: number }) {
  const [latest, setLatest] = useState<ScoreData | null>(null);

  useEffect(() => {
    fetch(`/api/stocks/${code}/score-history?weeks=1`)
      .then(r => r.json())
      .then(d => {
        const data = d?.data || [];
        if (data.length > 0) setLatest(data[data.length - 1]);
      })
      .catch(() => {});
  }, [code]);

  if (!latest) {
    return (
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        점수 분석 로딩 중...
      </div>
    );
  }

  // 강점/약점 정렬 (활용도 % 기준)
  const layerData = LAYERS.map(L => ({
    ...L,
    score: latest[L.key as LayerKey] ?? 0,
    pct: ((latest[L.key as LayerKey] ?? 0) / L.max) * 100,
  }));
  const sortedByPct = [...layerData].sort((a, b) => b.pct - a.pct);
  const top2 = sortedByPct.slice(0, 2);
  const bottom1 = sortedByPct[sortedByPct.length - 1];

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* 한 줄 요약 */}
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--accent-green)' }}>강점:</span>{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{top2.map(t => t.label).join(', ')}</strong>
        {bottom1.pct < 40 && (
          <>
            {' · '}
            <span style={{ color: 'var(--accent-red)' }}>약점:</span>{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{bottom1.label}</strong>
          </>
        )}
      </div>

      {/* 6 layer 점수 그리드 */}
      <div className="grid grid-cols-3 gap-1.5">
        {LAYERS.map(L => {
          const score = latest[L.key as LayerKey] ?? 0;
          const pct = (score / L.max) * 100;
          const strength = getStrengthLabel(pct);
          const Icon = L.icon;
          return (
            <div key={L.key} className="rounded-md px-2 py-1.5"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1">
                  <Icon size={10} style={{ color: strength.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {L.label}
                  </span>
                </div>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{L.weight}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold" style={{ color: strength.color }}>
                  {score.toFixed(1)}
                </span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>/{L.max}</span>
                <span className="text-[9px] ml-auto" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {L.kor}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
