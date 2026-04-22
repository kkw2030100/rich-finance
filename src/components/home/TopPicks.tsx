'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { mockStocks, getVerdictLabel, getVerdictColor, formatPercent } from '@/data/mock-stocks';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

export function TopPicks() {
  const { toggle, isFavorite } = useFavorites();

  const picks = mockStocks
    .filter(s => !s.killZone)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          오늘의 저평가 TOP
        </h2>
        <Link href="/stocks" className="text-xs font-medium" style={{ color: 'var(--accent-blue)' }}>
          전체 보기 →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {picks.map(stock => {
          const vColor = getVerdictColor(stock.verdict.verdict);
          const isUp = stock.priceChange >= 0;
          return (
            <div key={stock.ticker}
              className="card-hover rounded-xl p-4 relative"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* Favorite toggle */}
              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  active={isFavorite(stock.ticker)}
                  onClick={(e) => { e.stopPropagation(); toggle(stock.ticker); }}
                  size={14}
                />
              </div>

              <Link href={`/stocks/${stock.ticker}`} className="block">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 pr-6">
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {stock.ticker} · {stock.market} · {stock.sector}
                    </div>
                  </div>
                  <div className="verdict-badge" style={{ background: `${vColor}18`, color: vColor }}>
                    {getVerdictLabel(stock.verdict.verdict)}
                  </div>
                </div>

                {/* Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>종합 점수</span>
                    <span className="text-sm font-black" style={{ color: vColor }}>{stock.score.total}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full score-bar" style={{ width: `${stock.score.total}%`, background: vColor }} />
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>저평가지수</div>
                    <div className="text-xs font-bold" style={{ color: stock.financials.undervalueIndex > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatPercent(stock.financials.undervalueIndex)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>PER</div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{stock.financials.per.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ROE</div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{stock.financials.roe.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {stock.price.toLocaleString()}원
                  </span>
                  <span className="flex items-center gap-0.5 text-xs font-bold"
                    style={{ color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {formatPercent(stock.priceChange)}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
