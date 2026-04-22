'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Shield, Target, AlertTriangle, XCircle, BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Stock } from '@/types/stock';
import { getVerdictLabel, getVerdictColor, formatNumber, formatPercent, marketRisk, getRiskLabel, getRiskColor } from '@/data/mock-stocks';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

function ScoreBreakdown({ stock }: { stock: Stock }) {
  const layers = [
    { label: '기본적 분석', value: stock.score.fundamental, max: 40, color: '#3b82f6', icon: BarChart3 },
    { label: '기술적 분석', value: stock.score.technical, max: 30, color: '#a855f7', icon: TrendingUp },
    { label: '거시경제', value: stock.score.macro, max: 20, color: '#f59e0b', icon: DollarSign },
    { label: '계절성', value: stock.score.seasonality, max: 10, color: '#06b6d4', icon: Activity },
  ];
  return (
    <div className="space-y-2.5">
      {layers.map(l => (
        <div key={l.label}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <l.icon size={12} style={{ color: l.color }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{l.value}/{l.max}</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full score-bar" style={{ width: `${(l.value / l.max) * 100}%`, background: l.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StockDetail({ stock }: { stock: Stock }) {
  const { toggle, isFavorite } = useFavorites();
  const vColor = getVerdictColor(stock.verdict.verdict);
  const isUp = stock.priceChange >= 0;
  const riskColor = getRiskColor(marketRisk.level);
  const f = stock.financials;

  if (stock.killZone) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto">
        <Link href="/stocks" className="flex items-center gap-1 text-sm mb-6" style={{ color: 'var(--accent-blue)' }}>
          <ArrowLeft size={16} /> 종목 탐색
        </Link>
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '2px solid var(--accent-red)' }}>
          <XCircle size={48} style={{ color: 'var(--accent-red)' }} className="mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--accent-red)' }}>위험 종목 제외</h1>
          <p className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{stock.name} ({stock.ticker})</p>
          <div className="rounded-lg p-4 inline-block" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{stock.killReason}</p>
          </div>
          <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Layer 0 위험 신호 필터에 의해 분석 대상에서 제외되었습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Back */}
      <Link href="/stocks" className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--accent-blue)' }}>
        <ArrowLeft size={16} /> 종목 탐색
      </Link>

      {/* === HERO === */}
      <div className="rounded-xl p-6 mb-4" style={{ background: 'var(--bg-card)', border: `1px solid ${vColor}40` }}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FavoriteButton
                active={isFavorite(stock.ticker)}
                onClick={(e) => { e.stopPropagation(); toggle(stock.ticker); }}
                size={20}
              />
              <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stock.name}</h1>
              <span className="verdict-badge text-base" style={{ background: `${vColor}18`, color: vColor }}>
                {getVerdictLabel(stock.verdict.verdict)}
              </span>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {stock.ticker} · {stock.market} · {stock.sector}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stock.price.toLocaleString()}원</div>
            <div className="flex items-center justify-end gap-1 text-sm font-bold"
              style={{ color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {formatPercent(stock.priceChange)}
            </div>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="flex items-center gap-4">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>확신도</div>
          <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full score-bar" style={{ width: `${stock.verdict.confidence}%`, background: vColor }} />
          </div>
          <div className="text-lg font-black" style={{ color: vColor }}>{stock.verdict.confidence}%</div>
        </div>

        {/* Market Risk Overlay */}
        <div className="mt-3 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
          style={{ background: `${riskColor}10`, color: riskColor }}>
          <Shield size={14} />
          시장 위험도 {getRiskLabel(marketRisk.level)} ({marketRisk.total}점) — {marketRisk.guide}
        </div>
      </div>

      {/* === 4 CARDS === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Card 1: Score Breakdown */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={14} style={{ color: 'var(--accent-blue)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>종합 점수</span>
            <span className="ml-auto text-xl font-black" style={{ color: vColor }}>{stock.score.total}</span>
          </div>
          <ScoreBreakdown stock={stock} />
        </div>

        {/* Card 2: Valuation */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} style={{ color: 'var(--accent-green)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>밸류에이션</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>저평가지수</span>
              <span className="text-sm font-bold" style={{ color: f.undervalueIndex > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatPercent(f.undervalueIndex)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PER</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.per.toFixed(1)}배</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PBR</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.pbr.toFixed(2)}배</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>EPS</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.eps.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* Card 3: Cashflow */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign size={14} style={{ color: 'var(--accent-purple)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>현금흐름</span>
          </div>
          <div className="rounded-lg p-2.5 mb-2" style={{ background: 'var(--bg-secondary)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{stock.cashflow.label}</div>
            <div className="flex gap-2 text-xs">
              <span style={{ color: stock.cashflow.operating === '+' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                영업 {stock.cashflow.operating}
              </span>
              <span style={{ color: stock.cashflow.investing === '-' ? 'var(--accent-blue)' : 'var(--accent-yellow)' }}>
                투자 {stock.cashflow.investing}
              </span>
              <span style={{ color: stock.cashflow.financing === '-' ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                재무 {stock.cashflow.financing}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ROE</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.roe.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>영업이익률</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.operatingMargin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Risk */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={14} style={{ color: 'var(--accent-yellow)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>안전성</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>부채비율</span>
              <span className="text-sm font-bold" style={{ color: f.debtRatio > 200 ? 'var(--accent-red)' : f.debtRatio > 100 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                {f.debtRatio.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>유동비율</span>
              <span className="text-sm font-bold" style={{ color: f.currentRatio >= 150 ? 'var(--accent-green)' : f.currentRatio >= 100 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                {f.currentRatio.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>시총</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatNumber(f.marketCap)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>시총 증감</span>
              <span className="text-sm font-bold" style={{ color: f.marketCapGrowth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatPercent(f.marketCapGrowth)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* === REASONS / RISKS / INVALIDATION === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Reasons */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-green)' }}>왜 이 판단인가?</h3>
          <div className="space-y-2">
            {stock.verdict.reasons.map((r, i) => (
              <div key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>{i + 1}</span>
                {r}
              </div>
            ))}
          </div>
        </div>

        {/* Risks */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-yellow)' }}>조심해야 할 것</h3>
          <div className="space-y-2">
            {stock.verdict.risks.map((r, i) => (
              <div key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-yellow)' }} />
                {r}
              </div>
            ))}
          </div>
        </div>

        {/* Invalidation */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-red)' }}>판단이 틀렸다고 봐야 할 조건</h3>
          <div className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <XCircle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
            {stock.verdict.invalidation}
          </div>
        </div>
      </div>

      {/* === FINANCIALS TABLE === */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>재무 데이터</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '매출액', value: formatNumber(f.revenue), growth: f.revenueGrowth },
            { label: '영업이익', value: formatNumber(f.operatingProfit), growth: f.operatingProfitGrowth },
            { label: '순이익', value: formatNumber(f.netIncome), growth: f.netIncomeGrowth },
            { label: '시가총액', value: formatNumber(f.marketCap), growth: f.marketCapGrowth },
          ].map(item => (
            <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
              <div className="text-xs font-semibold" style={{ color: item.growth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatPercent(item.growth)} YoY
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
