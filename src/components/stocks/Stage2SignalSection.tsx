'use client';

import { useEffect, useState } from 'react';
import { Rocket, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

interface Stage2Data {
  hasSignal: boolean;
  latest?: {
    scanDate: string;
    score: number;
    boxPos: number;
    maDiff: number;
    ma60Slope: number;
    volRatio: number;
    ret4w: number;
    confirmed: boolean;
  };
  firstSeen?: string;
  daysSince?: number;
  history?: Array<{ date: string; score: number; confirmed: boolean }>;
}

export function Stage2SignalSection({ code }: { code: string }) {
  const [data, setData] = useState<Stage2Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stage2/${code}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return null;
  if (!data?.hasSignal || !data.latest) return null;

  const s = data.latest;

  // 점수 등급
  const scoreLevel = s.score >= 16 ? 'strong' : s.score >= 13 ? 'mid' : 'basic';
  const scoreColor = scoreLevel === 'strong' ? 'var(--accent-red)' : scoreLevel === 'mid' ? 'var(--accent-yellow)' : 'var(--accent-blue)';
  const scoreLabel = scoreLevel === 'strong' ? '매우 강함' : scoreLevel === 'mid' ? '강함' : '기본';

  // 필수 4조건 통과 여부
  const checks = [
    { label: '박스 상단 돌파', value: `${s.boxPos.toFixed(0)}%`, pass: s.boxPos >= 90 },
    { label: 'MA 수렴 (베이스 형성)', value: `${s.maDiff.toFixed(1)}%`, pass: s.maDiff <= 8 },
    { label: 'MA60 기울기 양전환', value: `${s.ma60Slope >= 0 ? '+' : ''}${s.ma60Slope.toFixed(2)}%`, pass: s.ma60Slope >= 0 },
    { label: '거래량 폭증 (스마트머니)', value: `${s.volRatio.toFixed(2)}x`, pass: s.volRatio >= 1.3 },
  ];

  return (
    <div className="rounded-2xl p-5 mb-4"
      style={{
        background: `linear-gradient(135deg, ${scoreColor}10, transparent)`,
        border: `1px solid ${scoreColor}40`,
      }}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${scoreColor}20` }}>
            <Rocket size={22} style={{ color: scoreColor }} />
          </div>
          <div>
            <div className="text-xs font-semibold mb-0.5" style={{ color: scoreColor }}>
              🚀 본격 상승 초기 신호 — {scoreLabel}
            </div>
            <div className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {s.score} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/ 20점</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>첫 발견</div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{data.firstSeen}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            ({(data.daysSince ?? 0) === 0 ? '오늘 신규' : `${data.daysSince}일째 유지`})
            {!s.confirmed && <span className="ml-1" style={{ color: 'var(--accent-yellow)' }}>· ⏳ 진행중</span>}
            {s.confirmed && <span className="ml-1" style={{ color: 'var(--accent-green)' }}>· ✅ 확정</span>}
          </div>
        </div>
      </div>

      {/* 4조건 체크 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-secondary)' }}>
            {c.pass
              ? <CheckCircle2 size={14} style={{ color: 'var(--accent-green)' }} />
              : <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} />}
            <div className="flex-1 text-[11px]" style={{ color: c.pass ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {c.label}
            </div>
            <div className="text-xs font-bold" style={{ color: c.pass ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* 진입 가이드 */}
      <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
          <TrendingUp size={13} /> 진입 가이드
        </div>
        <div className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          <div>· <strong>분할 매수 권장</strong> — 3~4주에 걸쳐 분할 진입 (한 번에 사지 말 것)</div>
          <div>· <strong>Stop-loss</strong>: 진입가 -8% 또는 26주 박스 하단 이탈 시</div>
          <div>· <strong>최근 4주 추세</strong>: {s.ret4w >= 0 ? '+' : ''}{s.ret4w.toFixed(1)}%
            {s.ret4w > 50 && <span style={{ color: 'var(--accent-red)' }}> (이미 급등 진행 — 추격 매수 신중)</span>}
            {s.ret4w >= 0 && s.ret4w <= 30 && <span style={{ color: 'var(--accent-green)' }}> (본격 상승 직전 패턴)</span>}
          </div>
          <div className="pt-1 mt-1 text-[10px]" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Weinstein Stage 1→2 진입 패턴. 3년 백테스트 26주 승률 92.9%, 평균 +30%
          </div>
        </div>
      </div>
    </div>
  );
}
