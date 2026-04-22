'use client';

import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';

export function SeasonalityCard() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const yearEnd = now.getFullYear() % 10;

  // 월별 계절성 (강환국)
  const isHeaven = month >= 11 || month <= 4;
  const monthLabel = isHeaven ? '천국 구간 (11~4월)' : '지옥 구간 (5~10월)';
  const monthScore = isHeaven ? 4 : (month === 7 ? 2 : (month >= 8 && month <= 9 ? -2 : 0));

  // 10년 주기
  const strongYears = [5, 9, 3];
  const weakYears = [2, 0];
  const yearScore = strongYears.includes(yearEnd) ? 2 : (weakYears.includes(yearEnd) ? -1 : 0);
  const yearLabel = strongYears.includes(yearEnd) ? '강세 해' : (weakYears.includes(yearEnd) ? '약세 해' : '중립 해');

  // 월말월초 효과
  const day = now.getDate();
  const isMonthEndStart = day >= 24 || day <= 4;
  const meScore = isMonthEndStart ? 2 : 0;

  const totalScore = monthScore + yearScore + meScore;
  const maxScore = 10;

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} style={{ color: 'var(--accent-purple)' }} />
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>계절성 점수</h2>
      </div>

      {/* Total */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl font-black" style={{ color: totalScore >= 4 ? 'var(--accent-green)' : totalScore >= 0 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
          {totalScore >= 0 ? '+' : ''}{totalScore}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>/ {maxScore}점</div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        {/* 월별 */}
        <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)' }}>
          {isHeaven
            ? <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
            : <TrendingDown size={14} style={{ color: 'var(--accent-red)' }} />
          }
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{month}월 — {monthLabel}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>핼러윈 효과 기반</div>
          </div>
          <span className="text-xs font-bold" style={{ color: monthScore > 0 ? 'var(--accent-green)' : monthScore < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
            {monthScore >= 0 ? '+' : ''}{monthScore}
          </span>
        </div>

        {/* 10년 주기 */}
        <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)' }}>
          <Calendar size={14} style={{ color: 'var(--accent-blue)' }} />
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>끝자리 {yearEnd} — {yearLabel}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>10년 주기 패턴</div>
          </div>
          <span className="text-xs font-bold" style={{ color: yearScore > 0 ? 'var(--accent-green)' : yearScore < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
            {yearScore >= 0 ? '+' : ''}{yearScore}
          </span>
        </div>

        {/* 월말월초 */}
        <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)' }}>
          <Calendar size={14} style={{ color: isMonthEndStart ? 'var(--accent-green)' : 'var(--text-muted)' }} />
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isMonthEndStart ? '월말월초 구간' : '비월말월초 구간'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>24일~4일 효과</div>
          </div>
          <span className="text-xs font-bold" style={{ color: meScore > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            +{meScore}
          </span>
        </div>
      </div>
    </div>
  );
}
