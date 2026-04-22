'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';
import { mockStocks, getVerdictLabel, getVerdictColor, formatPercent } from '@/data/mock-stocks';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

export function FavoriteStocks() {
  const { favorites, toggle, isFavorite, loaded } = useFavorites();

  if (!loaded) return null;

  const favStocks = mockStocks.filter(s => favorites.includes(s.ticker));

  if (favStocks.length === 0) {
    return (
      <div>
        <h2 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>
          <Star size={16} fill="#facc15" stroke="#facc15" className="inline mr-1.5 -mt-0.5" />
          내 관심종목
        </h2>
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Star size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            관심종목을 추가하면 여기에 표시됩니다
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            종목 카드의 <Star size={11} className="inline -mt-0.5" style={{ color: 'var(--text-muted)' }} /> 아이콘을 눌러 추가하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          <Star size={16} fill="#facc15" stroke="#facc15" className="inline mr-1.5 -mt-0.5" />
          내 관심종목
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{favStocks.length}개</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {favStocks.map(stock => {
          const vColor = getVerdictColor(stock.verdict.verdict);
          const isUp = stock.priceChange >= 0;
          return (
            <div key={stock.ticker}
              className="card-hover rounded-xl p-4 relative"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* Favorite toggle */}
              <div className="absolute top-3 right-3">
                <FavoriteButton active={true} onClick={(e) => { e.preventDefault(); toggle(stock.ticker); }} size={14} />
              </div>

              <Link href={`/stocks/${stock.ticker}`}>
                <div className="flex items-start justify-between mb-2 pr-6">
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {stock.ticker} · {stock.sector}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="verdict-badge" style={{ background: `${vColor}18`, color: vColor }}>
                    {getVerdictLabel(stock.verdict.verdict)}
                  </span>
                  <span className="text-sm font-black" style={{ color: vColor }}>{stock.score.total}점</span>
                </div>

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
