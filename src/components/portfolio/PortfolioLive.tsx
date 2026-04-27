'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { LogIn, Plus, Trash2, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useHoldings, type Holding } from '@/lib/useHoldings';
import { formatMoney, formatPrice, formatPct } from '@/lib/api';
import { AddHoldingModal } from './AddHoldingModal';

type Stage = 'early' | 'rapid' | 'steady' | 'late';
const STAGE_OF_TYPE: Record<string, Stage> = {
  confluence: 'early', daily: 'early', weekly: 'early',
  mid_rapid: 'rapid', mid_rapid_daily: 'rapid',
  mid_steady: 'steady', mid_steady_daily: 'steady',
  late_stage: 'late', late_stage_daily: 'late',
};
const STAGE_META: Record<Stage, { label: string; emoji: string; color: string; bg: string }> = {
  early:  { label: '상승 초기', emoji: '🌱', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  rapid:  { label: '급등 중',   emoji: '⚡', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  steady: { label: '상승 중',   emoji: '🐢', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  late:   { label: '추격 위험', emoji: '⚠️', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
};

interface SignalInfo {
  stages: Stage[];
  signalTypes: string[];
}

interface CurrentPrice {
  price: number | null;
  market: string;
}

export function PortfolioLive() {
  const { user, loading: authLoading } = useAuth();
  const { holdings, loaded, add, remove } = useHoldings();
  const [showAdd, setShowAdd] = useState(false);
  const [signals, setSignals] = useState<Map<string, SignalInfo>>(new Map());
  const [prices, setPrices] = useState<Map<string, CurrentPrice>>(new Map());

  // 보유 종목별 현재 시그널 + 가격 fetch
  useEffect(() => {
    if (holdings.length === 0) return;

    // 모든 6+3 signal type 가져와서 집계
    const types = ['confluence', 'daily', 'weekly',
                   'mid_rapid', 'mid_steady', 'late_stage',
                   'mid_rapid_daily', 'mid_steady_daily', 'late_stage_daily'];

    Promise.all(types.map(t =>
      fetch(`/api/breakout?limit=500&type=${t}`).then(r => r.json()).catch(() => ({ data: [] }))
    )).then(results => {
      const signalMap = new Map<string, SignalInfo>();
      const priceMap = new Map<string, CurrentPrice>();

      for (let i = 0; i < types.length; i++) {
        const t = types[i];
        const stage = STAGE_OF_TYPE[t];
        for (const item of results[i]?.data || []) {
          let entry = signalMap.get(item.code);
          if (!entry) {
            entry = { stages: [], signalTypes: [] };
            signalMap.set(item.code, entry);
          }
          if (!entry.stages.includes(stage)) entry.stages.push(stage);
          entry.signalTypes.push(t);
          // 가격 정보도 같이 추출
          if (item.price != null && !priceMap.has(item.code)) {
            priceMap.set(item.code, { price: item.price, market: item.market });
          }
        }
      }
      setSignals(signalMap);
      setPrices(priceMap);
    });
  }, [holdings]);

  // 가격 못 받은 종목들은 search API로 보충 (시그널 없는 종목)
  useEffect(() => {
    const missing = holdings.filter(h => !prices.has(h.ticker));
    if (missing.length === 0) return;
    Promise.all(missing.map(h =>
      fetch(`/api/stocks/${h.ticker}`).then(r => r.json()).catch(() => null)
    )).then(results => {
      setPrices(prev => {
        const next = new Map(prev);
        for (let i = 0; i < missing.length; i++) {
          const r = results[i];
          if (r && r.price != null) {
            next.set(missing[i].ticker, { price: r.price, market: r.market || 'kospi' });
          }
        }
        return next;
      });
    });
  }, [holdings, prices]);

  // 추격 위험 보유 종목 (매도 시그널)
  const sellAlerts = useMemo(() => {
    return holdings.filter(h => signals.get(h.ticker)?.stages.includes('late'));
  }, [holdings, signals]);

  // ============ 비로그인 상태 ============
  if (authLoading) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={14} className="animate-spin" /> 로딩 중...
    </div>;
  }

  if (!user) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Briefcase size={40} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>로그인이 필요한 기능</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          포트폴리오는 사용자별로 관리되어 안전하게 저장됩니다.<br />
          로그인하면 보유 종목의 매도 시그널을 자동으로 추적해 드립니다.
        </p>
        <Link href="/login?next=/portfolio"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: 'var(--accent-blue)', color: 'white' }}>
          <LogIn size={14} /> 로그인하고 시작하기
        </Link>
      </div>
    );
  }

  // ============ 로그인 후 ============
  return (
    <>
      {/* 매도 시그널 알림 (있을 때만) */}
      {sellAlerts.length > 0 && (
        <div className="rounded-xl p-4 mb-4 flex items-start gap-3"
          style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.4)' }}>
          <AlertTriangle size={20} style={{ color: 'var(--accent-yellow)' }} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-bold mb-1" style={{ color: 'var(--accent-yellow)' }}>
              🚨 매도 검토 종목 {sellAlerts.length}개
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              아래 종목이 추격 위험 단계 진입했습니다. 백테스트 결과 12주 후 중간 -5.4%, 손실률 44% — 보유 시 수익실현을 검토하세요.
            </div>
          </div>
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          총 <strong style={{ color: 'var(--text-primary)' }}>{holdings.length}종목</strong> 보유 중
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--accent-blue)', color: 'white' }}>
          <Plus size={14} /> 보유 종목 추가
        </button>
      </div>

      {/* 빈 상태 */}
      {!loaded ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
        </div>
      ) : holdings.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Briefcase size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            아직 등록된 보유 종목이 없습니다.
          </p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: 'var(--accent-blue)', color: 'white' }}>
            <Plus size={14} /> 첫 종목 추가하기
          </button>
        </div>
      ) : (
        <div className="rounded-xl overflow-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table className="w-full min-w-[900px] sticky-header">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>매수가</th>
                <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>손익률</th>
                <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>수량</th>
                <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재 단계</th>
                <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>매도 시그널</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => {
                const sig = signals.get(h.ticker);
                const px = prices.get(h.ticker);
                const currentPrice = px?.price;
                const market = px?.market || 'kospi';
                const pnl = currentPrice ? ((currentPrice - h.buy_price) / h.buy_price) * 100 : null;
                return (
                  <tr key={h.id} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-3 py-3">
                      <Link href={`/stocks/${h.ticker}`}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.ticker}</div>
                        {h.buy_date && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{h.buy_date}</div>}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                      {formatPrice(h.buy_price, market)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                      {currentPrice ? formatPrice(currentPrice, market) : '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {pnl != null ? (
                        <div className="text-sm font-bold flex items-center justify-end gap-0.5"
                          style={{ color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {pnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {formatPct(pnl)}
                        </div>
                      ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {h.quantity ? `${h.quantity.toLocaleString()}주` : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sig && sig.stages.length > 0 ? (
                          (['early','rapid','steady','late'] as Stage[]).filter(st => sig.stages.includes(st)).map(st => {
                            const meta = STAGE_META[st];
                            return (
                              <span key={st} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: meta.bg, color: meta.color }}>
                                {meta.emoji} {meta.label}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>신호 없음</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {sig?.stages.includes('late') ? (
                        <div className="flex items-center gap-1" style={{ color: 'var(--accent-yellow)' }}>
                          <AlertTriangle size={12} /> <strong>매도 검토</strong>
                        </div>
                      ) : sig?.stages.includes('rapid') ? (
                        <div className="flex items-center gap-1" style={{ color: 'var(--accent-red)' }}>
                          <ArrowUpRight size={12} /> 강한 모멘텀, 끝까지 보유 추천
                        </div>
                      ) : sig?.stages.includes('steady') || sig?.stages.includes('early') ? (
                        <div className="flex items-center gap-1" style={{ color: 'var(--accent-green)' }}>
                          <CheckCircle size={12} /> 보유 유지
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => { if (confirm(`${h.ticker} 보유 기록을 삭제하시겠습니까?`)) remove(h.id); }}
                        className="p-1.5 rounded cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 매도 전략 가이드 */}
      <div className="mt-4 rounded-xl p-4 text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
        <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>📊 매도 전략 (백테스트 검증)</div>
        <div className="space-y-1">
          <div>· <strong style={{ color: 'var(--accent-green)' }}>🐢 상승 / ⚡ 급등</strong> — 보유 유지. 추격 위험 단계 진입까지 끝까지 가는 게 가장 큰 수익 (백테스트 평균 +64%, 승률 84%)</div>
          <div>· <strong style={{ color: 'var(--accent-yellow)' }}>⚠️ 추격 위험</strong> — 매도 검토. 12주 후 중간 -5.4%, 손실률 44% (Parabolic blow-off 위험)</div>
          <div>· <strong style={{ color: 'var(--text-secondary)' }}>대안</strong> — 짧게 운영하려면 트레일링 -20% 손절 (백테스트 평균 +33%, 1년 보유)</div>
        </div>
      </div>

      {/* 모달 */}
      {showAdd && (
        <AddHoldingModal
          onClose={() => setShowAdd(false)}
          onAdd={async (h) => { await add(h); setShowAdd(false); }}
        />
      )}
    </>
  );
}

function Briefcase({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} style={style}>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M2 8h20a0 0 0 0 1 0 0v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a0 0 0 0 1 0 0z"/>
  </svg>;
}
