'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowUpRight, ArrowDownRight, Star, TrendingUp, DollarSign, BarChart3, Layers, Users } from 'lucide-react';
import { formatBillion, formatPct } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

type Mode = 'total' | 'ttm' | 'gap' | 'composite' | 'analyst';

const MODES: { key: Mode; label: string; desc: string; icon: typeof Layers; color: string }[] = [
  { key: 'total', label: '종합 저평가 종목', desc: '모든 기준을 종합한 점수', icon: Layers, color: 'var(--accent-blue)' },
  { key: 'ttm', label: '지금 싼 종목', desc: '벌고 있는 돈에 비해 가격이 싼 종목', icon: DollarSign, color: 'var(--accent-green)' },
  { key: 'gap', label: '아직 덜 오른 종목', desc: '돈을 더 잘 벌게 됐는데 가격이 안 오른 종목', icon: TrendingUp, color: 'var(--accent-purple)' },
  { key: 'composite', label: '싸고 좋은 기업', desc: '가격도 싸고 기업 체질도 좋은 종목', icon: BarChart3, color: 'var(--accent-yellow)' },
  { key: 'analyst', label: '전문가가 더 오른다고 본 종목', desc: '증권사 목표가 대비 현재가가 낮은 종목', icon: Users, color: 'var(--accent-blue)' },
];

interface ScreenerItem {
  code: string; name: string; market: string;
  price: number; changePct: number; marketCap: number; tier: string;
  perTtm: number | null; porTtm: number | null; psrTtm: number | null;
  ttmNi: number; ttmOp: number; ttmRevenue: number;
  niChangeAmount: number | null; mcapChangeAmount: number | null;
  gapPct: number | null; profitStatus: string | null;
  valueScore: number | null; qualityScore: number | null; quadrant: string | null;
  // analyst mode
  niChange: number | null; niGapRatio: number | null;
  turnaround: boolean; deficitTurn: boolean;
  uiQuadrant: string | null; uiIndex: number | null;
  score: number; verdict: string;
  targetPriceWeighted?: number; upside?: number;
  analystCount?: number; rating?: number;
  currentPrice?: number;
}

function getQuadrantColor(q: string | null) {
  switch (q) {
    case '저평가+고품질': return '#22c55e';
    case '고평가+고품질': return '#3b82f6';
    case '저평가+저품질': return '#f97316';
    case '고평가+저품질': return '#ef4444';
    default: return '#6b7280';
  }
}

export function ScreenerLive() {
  const [mode, setMode] = useState<Mode>('total');
  const [data, setData] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toggle, isFavorite } = useFavorites();

  useEffect(() => {
    setLoading(true);
    const url = mode === 'analyst'
      ? '/api/undervalued?mode=analyst&limit=50'
      : `/api/undervalued?mode=${mode}&limit=50`;
    fetch(url)
      .then(r => r.json())
      .then(d => setData(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode]);

  const current = MODES.find(m => m.key === mode)!;

  return (
    <div>
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-1 overflow-x-auto">
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            style={{
              background: mode === m.key ? `${m.color}15` : 'var(--bg-card)',
              color: mode === m.key ? m.color : 'var(--text-secondary)',
              border: `1px solid ${mode === m.key ? `${m.color}40` : 'var(--border)'}`,
            }}>
            <m.icon size={16} />
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{current.desc}</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>스크리닝 중...</span>
        </div>
      ) : (
        <>
          <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: current.color }}>{data.length}개</span> 종목
          </div>

          <div className="rounded-xl overflow-auto max-h-[70vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <table className="w-full min-w-[800px] sticky-header">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                    {mode === 'ttm' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PER(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>POR(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PSR(TTM)</th>
                      </>
                    )}
                    {mode === 'gap' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>순이익 증감(억)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총 증감(억)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>괴리율</th>
                      </>
                    )}
                    {mode === 'composite' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>Value</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>Quality</th>
                        <th className="text-center px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>4분면</th>
                      </>
                    )}
                    {mode === 'total' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PER(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>괴리율</th>
                      </>
                    )}
                    {mode === 'analyst' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>목표가</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>상승여력</th>
                        <th className="text-center px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>투자의견</th>
                      </>
                    )}
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((stock, i) => (
                    <tr key={stock.code} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-2 py-3 text-center">
                        <FavoriteButton active={isFavorite(stock.code)} onClick={() => toggle(stock.code)} size={14} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/stocks/${stock.code}`}>
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                            {stock.profitStatus === 'turnaround' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>흑자전환</span>
                            )}
                            {stock.profitStatus === 'loss_turn' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>적자전환</span>
                            )}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stock.code} · {stock.market.toUpperCase()} · {stock.tier}</div>
                        </Link>
                      </td>

                      {mode === 'ttm' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.perTtm ? stock.perTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {stock.porTtm ? stock.porTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {stock.psrTtm ? stock.psrTtm + '배' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'gap' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.niChangeAmount ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niChangeAmount !== null ? (stock.niChangeAmount >= 0 ? '+' : '') + stock.niChangeAmount.toLocaleString() + '억' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: (stock.mcapChangeAmount ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.mcapChangeAmount !== null ? (stock.mcapChangeAmount >= 0 ? '+' : '') + stock.mcapChangeAmount.toLocaleString() + '억' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-black" style={{ color: (stock.gapPct ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.gapPct !== null ? (stock.gapPct > 0 ? '+' : '') + stock.gapPct + '%' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'composite' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.valueScore ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.qualityScore ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {stock.quadrant && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{ background: `${getQuadrantColor(stock.quadrant)}15`, color: getQuadrantColor(stock.quadrant) }}>
                                {stock.quadrant === '저평가+고품질' && '★ '}{stock.quadrant}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {mode === 'total' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                            {stock.perTtm ? stock.perTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.gapPct ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.gapPct !== null ? (stock.gapPct > 0 ? '+' : '') + stock.gapPct + '%' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'analyst' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.targetPriceWeighted ? stock.targetPriceWeighted.toLocaleString() + '원' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-black" style={{ color: (stock.upside ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.upside != null ? (stock.upside > 0 ? '+' : '') + stock.upside + '%' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {stock.rating ? '★' + stock.rating.toFixed(1) : '-'}
                              {stock.analystCount ? ` (${stock.analystCount})` : ''}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        {formatBillion(stock.marketCap)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{stock.price.toLocaleString()}원</div>
                        <div className="text-[10px] flex items-center justify-end gap-0.5"
                          style={{ color: stock.changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {stock.changePct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {formatPct(stock.changePct)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>

          <div className="text-center text-[10px] py-3" style={{ color: 'var(--text-muted)' }}>
            본 분석은 투자 자문이 아닌 정보 제공 목적이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
          </div>
        </>
      )}
    </div>
  );
}
