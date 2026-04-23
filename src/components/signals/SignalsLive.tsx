'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Zap, TrendingUp, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

type SignalType = 'turnaround' | 'volume_spike' | 'gap_change';

const TABS: { key: SignalType; label: string; icon: typeof RefreshCw; color: string }[] = [
  { key: 'turnaround', label: '흑자전환', icon: RefreshCw, color: 'var(--accent-green)' },
  { key: 'volume_spike', label: '거래량 급증', icon: Zap, color: 'var(--accent-yellow)' },
  { key: 'gap_change', label: '괴리율 TOP', icon: TrendingUp, color: 'var(--accent-purple)' },
];

export function SignalsLive() {
  const [tab, setTab] = useState<SignalType>('turnaround');
  const [data, setData] = useState<{ type: string; count: number; data: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/signals?type=${tab}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  const currentTab = TABS.find(t => t.key === tab)!;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: tab === t.key ? `${t.color}15` : 'var(--bg-card)',
              color: tab === t.key ? t.color : 'var(--text-secondary)',
              border: `1px solid ${tab === t.key ? `${t.color}40` : 'var(--border)'}`,
            }}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>신호 탐지 중...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>데이터 없음</div>
      ) : (
        <div>
          <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: currentTab.color }}>{data.count}개</span> 종목 감지됨
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="text-left px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                    {tab === 'turnaround' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>전분기 순이익</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현분기 순이익</th>
                      </>
                    )}
                    {tab === 'volume_spike' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>거래량</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>배율</th>
                      </>
                    )}
                    {tab === 'gap_change' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>순이익증감</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총증감</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>괴리율</th>
                      </>
                    )}
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>등락</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => {
                    const code = row.code as string;
                    const name = row.name as string;
                    const market = row.market as string;
                    const price = row.price as number || row.close as number;
                    const changePct = row.change_pct as number;
                    const isUp = (changePct || 0) >= 0;

                    return (
                      <tr key={code + '-' + i} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <Link href={`/stocks/${code}`}>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{code} · {(market || '').toUpperCase()}</div>
                          </Link>
                        </td>
                        {tab === 'turnaround' && (
                          <>
                            <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--accent-red)' }}>
                              {((row.prev_ni as number) || 0).toLocaleString()}억
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
                              {((row.curr_ni as number) || 0).toLocaleString()}억
                            </td>
                          </>
                        )}
                        {tab === 'volume_spike' && (
                          <>
                            <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                              {((row.volume as number) || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--accent-yellow)' }}>
                              {(row.volumeRatio as number)?.toFixed(1)}x
                            </td>
                          </>
                        )}
                        {tab === 'gap_change' && (
                          <>
                            <td className="px-3 py-3 text-right text-sm" style={{ color: (row.niGrowth as number) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {(row.niGrowth as number) >= 0 ? '+' : ''}{(row.niGrowth as number)?.toFixed(1)}%
                            </td>
                            <td className="px-3 py-3 text-right text-sm" style={{ color: (row.mcapGrowth as number) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {(row.mcapGrowth as number) >= 0 ? '+' : ''}{(row.mcapGrowth as number)?.toFixed(1)}%
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (row.gap as number) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {(row.gap as number) > 0 ? '+' : ''}{(row.gap as number)?.toFixed(1)}%p
                            </td>
                          </>
                        )}
                        <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                          {(price || 0).toLocaleString()}원
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="flex items-center justify-end gap-0.5 text-xs font-bold"
                            style={{ color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {changePct ? (changePct >= 0 ? '+' : '') + changePct.toFixed(1) + '%' : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center text-[10px] py-3" style={{ color: 'var(--text-muted)' }}>
            본 분석은 투자 자문이 아닌 정보 제공 목적이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
          </div>
        </div>
      )}
    </div>
  );
}
