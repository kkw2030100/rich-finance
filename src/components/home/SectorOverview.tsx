'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { sectorSummaries, formatPercent } from '@/data/mock-stocks';

export function SectorOverview() {
  const sorted = [...sectorSummaries].sort((a, b) => b.avgUndervalueIndex - a.avgUndervalueIndex);

  return (
    <div>
      <h2 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>
        섹터별 저평가 현황
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>섹터</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>종목 수</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>평균 저평가지수</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TOP 종목</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>추세</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((sector, i) => (
              <tr key={sector.name} className="card-hover cursor-pointer" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sector.name}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sector.stockCount}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold"
                    style={{ color: sector.avgUndervalueIndex > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {formatPercent(sector.avgUndervalueIndex)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm" style={{ color: 'var(--accent-blue)' }}>{sector.topStock}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {sector.trend === 'up' && <TrendingUp size={16} style={{ color: 'var(--accent-green)' }} className="inline" />}
                  {sector.trend === 'down' && <TrendingDown size={16} style={{ color: 'var(--accent-red)' }} className="inline" />}
                  {sector.trend === 'flat' && <Minus size={16} style={{ color: 'var(--text-muted)' }} className="inline" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
