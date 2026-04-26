'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowUpRight, ArrowDownRight, Star, TrendingUp, DollarSign, BarChart3, Layers, Users, Rocket, Search } from 'lucide-react';
import { formatBillion, formatPct } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';
import { StockTableLive } from '@/components/stocks/StockTableLive';

type Mode = 'all' | 'total' | 'ttm' | 'gap' | 'composite' | 'analyst' | 'breakout';

const MODES: { key: Mode; label: string; desc: string; icon: typeof Layers; color: string }[] = [
  { key: 'all', label: '전종목', desc: '시장/시총/관심종목 자유 탐색', icon: Search, color: 'var(--accent-blue)' },
  { key: 'breakout', label: '본격 상승 가능', desc: '베이스 형성 후 박스권 돌파 + 거래량 폭증 — 본격 급등 직전 패턴', icon: Rocket, color: 'var(--accent-red)' },
  { key: 'total', label: '종합 저평가', desc: '모든 기준을 종합한 점수', icon: Layers, color: 'var(--accent-blue)' },
  { key: 'ttm', label: '지금 싼 종목', desc: '벌고 있는 돈에 비해 가격이 싼 종목', icon: DollarSign, color: 'var(--accent-green)' },
  { key: 'gap', label: '아직 덜 오른 종목', desc: '돈을 더 잘 벌게 됐는데 가격이 안 오른 종목', icon: TrendingUp, color: 'var(--accent-purple)' },
  { key: 'composite', label: '싸고 좋은 기업', desc: '가격도 싸고 기업 체질도 좋은 종목', icon: BarChart3, color: 'var(--accent-yellow)' },
  { key: 'analyst', label: '전문가 매수의견', desc: '증권사 목표가 대비 현재가가 낮은 종목', icon: Users, color: 'var(--accent-blue)' },
];

interface BreakoutItem {
  code: string; name: string; market: string;
  score: number; boxPos: number; maDiff: number;
  ma60Slope: number; volRatio: number; ret4w: number;
  confirmed: boolean; isNew: boolean; firstSeen: string;
  price: number | null; changePct: number | null; marketCap: number | null;
}

interface ScreenerItem {
  code: string; name: string; market: string;
  price: number; changePct: number; marketCap: number; tier: string;
  perTtm: number | null; porTtm: number | null; psrTtm: number | null;
  ttmNi: number; ttmOp: number; ttmRevenue: number;
  mcapChange: number | null;
  // backend fields
  niChange: number | null; niGapRatio: number | null;
  turnaround: boolean; deficitTurn: boolean;
  uiQuadrant: string | null; uiIndex: number | null;
  uiValue: number | null; uiQuality: number | null;
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
  const [mode, setMode] = useState<Mode>('all');
  const [data, setData] = useState<ScreenerItem[]>([]);
  const [breakoutData, setBreakoutData] = useState<BreakoutItem[]>([]);
  const [breakoutMeta, setBreakoutMeta] = useState<{ asOf: string | null; newCount: number; keptCount: number }>({ asOf: null, newCount: 0, keptCount: 0 });
  const [loading, setLoading] = useState(true);
  const { toggle, isFavorite } = useFavorites();

  useEffect(() => {
    if (mode === 'all') {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (mode === 'breakout') {
      fetch('/api/breakout?limit=100')
        .then(r => r.json())
        .then(d => {
          setBreakoutData(d.data || []);
          setBreakoutMeta({ asOf: d.asOf, newCount: d.newCount || 0, keptCount: d.keptCount || 0 });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/undervalued?mode=${mode}&limit=50`)
        .then(r => r.json())
        .then(d => setData(d.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
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

      {mode !== 'all' && mode !== 'breakout' && (
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          ※ 큐레이션 모드는 한국 종목 기반입니다. 미국 종목은 &apos;전종목&apos; 또는 &apos;본격 상승 가능&apos; 탭에서 확인하세요.
        </p>
      )}

      {mode === 'all' ? (
        <StockTableLive />
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>스크리닝 중...</span>
        </div>
      ) : mode === 'breakout' ? (
        <>
          <div className="mb-3 text-xs flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: current.color }}>{breakoutData.length}개 종목</span>
            {breakoutMeta.asOf && <span>· 기준일 {breakoutMeta.asOf}</span>}
            {breakoutMeta.newCount > 0 && (
              <span style={{ color: 'var(--accent-green)' }}>🆕 신규 {breakoutMeta.newCount}</span>
            )}
            {breakoutMeta.keptCount > 0 && (
              <span>🔄 유지 {breakoutMeta.keptCount}</span>
            )}
          </div>

          {breakoutData.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Rocket size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">현재 본격 상승 가능 신호 종목이 없습니다.</p>
              <p className="text-xs mt-1">매일 16:30 한국 시장 마감 후 자동 스캔됩니다.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-auto max-h-[70vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <table className="w-full min-w-[900px] sticky-header">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                    <th className="text-center px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>상태</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>신호 점수</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>박스 위치</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>거래량</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>4주 추세</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                  </tr>
                </thead>
                <tbody>
                  {breakoutData.map((s, i) => (
                    <tr key={s.code} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-2 py-3 text-center">
                        <FavoriteButton active={isFavorite(s.code)} onClick={() => toggle(s.code)} size={14} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/stocks/${s.code}`}>
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {s.code} · {s.market} · 첫 발견 {s.firstSeen}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {s.isNew ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>
                            🆕 신규
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            🔄 유지
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-black" style={{ color: s.score >= 16 ? 'var(--accent-red)' : s.score >= 13 ? 'var(--accent-yellow)' : 'var(--text-primary)' }}>
                          {s.score}
                        </span>
                        <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>/20</span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        {s.boxPos.toFixed(0)}%
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: s.volRatio >= 1.5 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                        {s.volRatio.toFixed(2)}x
                      </td>
                      <td className="px-3 py-3 text-right text-sm" style={{ color: s.ret4w >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {s.ret4w >= 0 ? '+' : ''}{s.ret4w.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        {s.marketCap ? formatBillion(s.marketCap) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {s.price ? s.price.toLocaleString() + '원' : '-'}
                        </div>
                        {s.changePct != null && (
                          <div className="text-[10px] flex items-center justify-end gap-0.5"
                            style={{ color: s.changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {s.changePct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {formatPct(s.changePct)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-xl p-4 text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>📊 신호 점수 해석 (10~20점)</div>
            <div className="space-y-1">
              <div>· <strong style={{ color: 'var(--accent-red)' }}>16+ 매우 강함</strong> — 본격 진입 유효, 분할 매수 권장</div>
              <div>· <strong style={{ color: 'var(--accent-yellow)' }}>13~15 강함</strong> — 필수 조건 + 가산점 확보</div>
              <div>· <strong style={{ color: 'var(--text-primary)' }}>10~12 기본</strong> — 필수 4조건 충족 (베이스 돌파 + MA 수렴 + 양 기울기 + 거래량 폭증)</div>
            </div>
            <div className="mt-3 pt-2 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Weinstein Stage 1→2 진입 패턴. 3년 백테스트 26주 승률 92.9%, 평균 +30% (Mark Minervini VCP / Darvas Box 기반)
            </div>
          </div>
        </>
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
                            {stock.turnaround && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>흑자전환</span>
                            )}
                            {stock.deficitTurn && (
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
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.niChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niChange != null ? (stock.niChange >= 0 ? '+' : '') + stock.niChange.toLocaleString() + '억' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: (stock.mcapChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.mcapChange != null ? (stock.mcapChange >= 0 ? '+' : '') + stock.mcapChange.toLocaleString() + '억' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-black" style={{ color: (stock.niGapRatio ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niGapRatio != null ? (stock.niGapRatio > 0 ? '+' : '') + stock.niGapRatio + '%' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'composite' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.uiValue ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.uiQuality ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {stock.uiQuadrant && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{ background: `${getQuadrantColor(stock.uiQuadrant)}15`, color: getQuadrantColor(stock.uiQuadrant) }}>
                                {stock.uiQuadrant === '저평가+고품질' && '★ '}{stock.uiQuadrant}
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
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.niGapRatio ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niGapRatio != null ? (stock.niGapRatio > 0 ? '+' : '') + stock.niGapRatio + '%' : 'N/A'}
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
                        {formatBillion(stock.marketCap ?? 0)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{(stock.price ?? 0).toLocaleString()}원</div>
                        <div className="text-[10px] flex items-center justify-end gap-0.5"
                          style={{ color: (stock.changePct ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {(stock.changePct ?? 0) >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
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
