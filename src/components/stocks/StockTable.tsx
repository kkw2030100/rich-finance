'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ArrowUpRight, ArrowDownRight, AlertOctagon, Star } from 'lucide-react';
import { mockStocks, getVerdictLabel, getVerdictColor, formatNumber, formatPercent } from '@/data/mock-stocks';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

type SortKey = 'score' | 'undervalue' | 'netIncomeGrowth' | 'marketCap' | 'per' | 'roe';

export function StockTable() {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [filterMarket, setFilterMarket] = useState<string>('ALL');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const { toggle, isFavorite, favorites } = useFavorites();

  const filtered = mockStocks.filter(s => {
    if (filterMarket !== 'ALL' && s.market !== filterMarket) return false;
    if (showFavOnly && !favorites.includes(s.ticker)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'score': return b.score.total - a.score.total;
      case 'undervalue': return b.financials.undervalueIndex - a.financials.undervalueIndex;
      case 'netIncomeGrowth': return b.financials.netIncomeGrowth - a.financials.netIncomeGrowth;
      case 'marketCap': return b.financials.marketCap - a.financials.marketCap;
      case 'per': return a.financials.per - b.financials.per;
      case 'roe': return b.financials.roe - a.financials.roe;
      default: return 0;
    }
  });

  const SortBtn = ({ label, sk }: { label: string; sk: SortKey }) => (
    <button onClick={() => setSortKey(sk)}
      className="flex items-center gap-0.5 text-xs font-semibold cursor-pointer"
      style={{ color: sortKey === sk ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
      {label} <ArrowUpDown size={10} />
    </button>
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        {['ALL', 'KOSPI', 'KOSDAQ'].map(m => (
          <button key={m} onClick={() => setFilterMarket(m)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: filterMarket === m ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
              color: filterMarket === m ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}>
            {m === 'ALL' ? '전체' : m}
          </button>
        ))}

        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        <button onClick={() => setShowFavOnly(!showFavOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          style={{
            background: showFavOnly ? 'rgba(250,204,21,0.15)' : 'var(--bg-card)',
            color: showFavOnly ? '#facc15' : 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}>
          <Star size={12} fill={showFavOnly ? '#facc15' : 'none'} stroke={showFavOnly ? '#facc15' : 'currentColor'} />
          관심종목{favorites.length > 0 && ` (${favorites.length})`}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="w-8 px-2 py-2.5" />
                <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                <th className="px-3 py-2.5"><SortBtn label="점수" sk="score" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="저평가지수" sk="undervalue" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="순이익증감" sk="netIncomeGrowth" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="시총" sk="marketCap" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="PER" sk="per" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="ROE" sk="roe" /></th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>판정</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock, i) => {
                const vColor = getVerdictColor(stock.verdict.verdict);
                return (
                  <tr key={stock.ticker} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-2 py-3 text-center">
                      <FavoriteButton
                        active={isFavorite(stock.ticker)}
                        onClick={(e) => { e.stopPropagation(); toggle(stock.ticker); }}
                        size={14}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/stocks/${stock.ticker}`} className="block">
                        <div className="flex items-center gap-2">
                          {stock.killZone && <AlertOctagon size={14} style={{ color: 'var(--accent-red)' }} />}
                          <div>
                            <div className="text-sm font-semibold" style={{ color: stock.killZone ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                              {stock.name}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {stock.ticker} · {stock.market} · {stock.sector}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-black" style={{ color: vColor }}>
                        {stock.killZone ? '—' : stock.score.total}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-bold" style={{ color: stock.financials.undervalueIndex > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatPercent(stock.financials.undervalueIndex)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: stock.financials.netIncomeGrowth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatPercent(stock.financials.netIncomeGrowth)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatNumber(stock.financials.marketCap)}</div>
                      <div className="text-[10px] flex items-center justify-end gap-0.5"
                        style={{ color: stock.financials.marketCapGrowth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {stock.financials.marketCapGrowth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {formatPercent(stock.financials.marketCapGrowth)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{stock.financials.per.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{stock.financials.roe.toFixed(1)}%</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="verdict-badge" style={{ background: `${vColor}18`, color: vColor }}>
                        {getVerdictLabel(stock.verdict.verdict)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
