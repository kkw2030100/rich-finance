'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getVerdictLabel, getVerdictColor, formatPercent } from '@/lib/format';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

interface TopPickStock {
  ticker: string;
  name: string;
  market: string;
  sector: string;
  totalScore: number;
  verdict: string;
  confidence: number;
  close: number;
  undervalueNi: number;
  niGrowth: number;
  mcapGrowth: number;
  reasons: string[];
}

export function TopPicks({ stocks }: { stocks: TopPickStock[] }) {
  const { toggle, isFavorite } = useFavorites();

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
        {stocks.map(stock => {
          const vColor = getVerdictColor(stock.verdict);
          return (
            <div key={stock.ticker}
              className="card-hover rounded-xl p-4 relative"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  active={isFavorite(stock.ticker)}
                  onClick={(e) => { e.stopPropagation(); toggle(stock.ticker); }}
                  size={14}
                />
              </div>

              <Link href={`/stocks/${stock.ticker}`} className="block">
                <div className="flex items-start justify-between mb-3 pr-6">
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {stock.ticker} · {stock.market} · {stock.sector}
                    </div>
                  </div>
                  <div className="verdict-badge" style={{ background: `${vColor}18`, color: vColor }}>
                    {getVerdictLabel(stock.verdict)}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>종합 점수</span>
                    <span className="text-sm font-black" style={{ color: vColor }}>{stock.totalScore.toFixed(1)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full score-bar" style={{ width: `${stock.totalScore}%`, background: vColor }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>저평가지수</div>
                    <div className="text-xs font-bold" style={{ color: stock.undervalueNi > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatPercent(stock.undervalueNi)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>순이익증감</div>
                    <div className="text-xs font-bold" style={{ color: stock.niGrowth > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatPercent(stock.niGrowth)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>신뢰도</div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{stock.confidence}%</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {stock.close.toLocaleString()}원
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {stock.reasons[0]}
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
