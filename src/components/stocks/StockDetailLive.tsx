'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Shield, BarChart3, TrendingUp, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchStockDetail, StockDetailResponse, formatBillion, formatPct, getVerdictInfo } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

export function StockDetailLive({ code }: { code: string }) {
  const [data, setData] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toggle, isFavorite } = useFavorites();

  useEffect(() => {
    fetchStockDetail(code)
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>종목 분석 불러오는 중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto">
        <Link href="/stocks" className="flex items-center gap-1 text-sm mb-6" style={{ color: 'var(--accent-blue)' }}>
          <ArrowLeft size={16} /> 종목 탐색
        </Link>
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-red)' }}>
          <p style={{ color: 'var(--accent-red)' }}>종목을 찾을 수 없습니다: {code}</p>
        </div>
      </div>
    );
  }

  const v = data.valuation;
  const g = data.gap;
  const isUp = data.changePct >= 0;

  // Simple score approximation
  let score = 50;
  if (v.perTtm && v.perTtm > 0 && v.perTtm < 10) score += 10;
  else if (v.perTtm && v.perTtm > 0 && v.perTtm < 20) score += 5;
  if (v.roe && v.roe > 15) score += 8;
  else if (v.roe && v.roe > 10) score += 4;
  if (v.debtRatio && v.debtRatio < 100) score += 4;
  if (g.undervalueIndex && g.undervalueIndex > 50) score += 8;
  else if (g.undervalueIndex && g.undervalueIndex > 20) score += 4;
  score = Math.min(score, 100);

  let verdict = 'hold';
  if (score >= 75) verdict = 'strong_buy';
  else if (score >= 60) verdict = 'buy';
  else if (score <= 25) verdict = 'strong_sell';
  else if (score <= 40) verdict = 'sell';

  const vi = getVerdictInfo(verdict);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Link href="/stocks" className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--accent-blue)' }}>
        <ArrowLeft size={16} /> 종목 탐색
      </Link>

      {/* HERO */}
      <div className="rounded-xl p-6 mb-4" style={{ background: 'var(--bg-card)', border: `1px solid ${vi.color}40` }}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FavoriteButton active={isFavorite(code)} onClick={() => toggle(code)} size={20} />
              <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{data.name}</h1>
              <span className="verdict-badge text-base" style={{ background: `${vi.color}18`, color: vi.color }}>
                {vi.label}
              </span>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {data.code} · {data.market.toUpperCase()} · {data.priceDate}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.price.toLocaleString()}원</div>
            <div className="flex items-center justify-end gap-1 text-sm font-bold"
              style={{ color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {formatPct(data.changePct)}
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-4">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>종합 점수</div>
          <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full score-bar" style={{ width: `${score}%`, background: vi.color }} />
          </div>
          <div className="text-lg font-black" style={{ color: vi.color }}>{score}</div>
        </div>
      </div>

      {/* 4 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Valuation */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} style={{ color: 'var(--accent-green)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>TTM 밸류에이션</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'PER(TTM)', value: v.perTtm ? v.perTtm + '배' : 'N/A' },
              { label: 'POR(TTM)', value: v.porTtm ? v.porTtm + '배' : 'N/A' },
              { label: 'PSR(TTM)', value: v.psrTtm ? v.psrTtm + '배' : 'N/A' },
              { label: 'PBR', value: v.pbr ? v.pbr.toFixed(2) + '배' : 'N/A' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gap Analysis */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} style={{ color: 'var(--accent-purple)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>괴리율 분석</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>순이익 증감</span>
              <span className="text-sm font-bold" style={{ color: (g.niGrowth ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatPct(g.niGrowth)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>시총 증감</span>
              <span className="text-sm font-bold" style={{ color: (g.mcapGrowth ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatPct(g.mcapGrowth)}
              </span>
            </div>
            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>괴리율</span>
                <span className="text-base font-black" style={{ color: (g.undervalueIndex ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {g.undervalueIndex !== null ? formatPct(g.undervalueIndex).replace('%', '%p') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profitability */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign size={14} style={{ color: 'var(--accent-blue)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>수익성</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'ROE', value: v.roe ? v.roe.toFixed(1) + '%' : 'N/A' },
              { label: '영업이익률', value: v.opMargin ? v.opMargin.toFixed(1) + '%' : 'N/A' },
              { label: 'EPS', value: v.eps ? v.eps.toLocaleString() + '원' : 'N/A' },
              { label: '시가총액', value: formatBillion(data.marketCap) },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={14} style={{ color: 'var(--accent-yellow)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>안전성</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>부채비율</span>
              <span className="text-sm font-bold" style={{
                color: (v.debtRatio ?? 0) > 200 ? 'var(--accent-red)' : (v.debtRatio ?? 0) > 100 ? 'var(--accent-yellow)' : 'var(--accent-green)'
              }}>
                {v.debtRatio ? v.debtRatio.toFixed(0) + '%' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TTM 매출</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatBillion(v.ttmRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TTM 영업이익</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatBillion(v.ttmOp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TTM 순이익</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatBillion(v.ttmNi)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quarterly Trend */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>분기별 실적 추이</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th className="text-left text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>분기</th>
                <th className="text-right text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>매출</th>
                <th className="text-right text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>영업이익</th>
                <th className="text-right text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>순이익</th>
              </tr>
            </thead>
            <tbody>
              {data.quarterlyTrend.map((q, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 text-sm" style={{ color: q.isEstimate ? 'var(--accent-yellow)' : 'var(--text-primary)' }}>
                    {q.period}{q.isEstimate ? ' (E)' : ''}
                  </td>
                  <td className="px-3 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>{formatBillion(q.revenue)}</td>
                  <td className="px-3 py-2 text-sm text-right" style={{ color: q.operatingProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {formatBillion(q.operatingProfit)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right" style={{ color: q.netIncome >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {formatBillion(q.netIncome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center text-[10px] py-4" style={{ color: 'var(--text-muted)' }}>
        본 분석은 투자 자문이 아닌 정보 제공 목적이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
      </div>
    </div>
  );
}
