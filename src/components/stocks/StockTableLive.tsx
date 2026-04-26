'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { ScoreItem, formatBillion, formatPct, getVerdictInfo, deriveTier, getCountry } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

type SortKey = 'score' | 'undervalue' | 'per' | 'marketCap';

interface StockTableLiveProps {
  data: ScoreItem[];
  loading?: boolean;
  countries?: string[];
  markets?: string[];
  tiers?: string[];
  showFavOnly?: boolean;
  search?: string;
}

export function StockTableLive({
  data,
  loading = false,
  countries = [],
  markets = [],
  tiers = [],
  showFavOnly = false,
  search = '',
}: StockTableLiveProps) {
  const [sortKey, setSortKey] = useState<SortKey>('undervalue');
  const { toggle, isFavorite, favorites } = useFavorites();

  const filtered = useMemo(() => {
    return data.filter(s => {
      const country = getCountry(s.market);
      const market = (s.market || '').toLowerCase();
      const tier = deriveTier(s.marketCap, s.market);

      if (countries.length > 0 && !countries.includes(country)) return false;
      if (markets.length > 0 && !markets.includes(market)) return false;
      if (tiers.length > 0 && !tiers.includes(tier)) return false;
      if (showFavOnly && !favorites.includes(s.code)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!s.code.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, countries, markets, tiers, showFavOnly, search, favorites]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'score':
        arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        break;
      case 'undervalue':
        arr.sort((a, b) => (b.niGapRatio ?? b.undervalueIndex ?? -Infinity) - (a.niGapRatio ?? a.undervalueIndex ?? -Infinity));
        break;
      case 'per':
        arr.sort((a, b) => (a.perTtm ?? Infinity) - (b.perTtm ?? Infinity));
        break;
      case 'marketCap':
        arr.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
        break;
    }
    return arr;
  }, [filtered, sortKey]);

  const SortBtn = ({ label, sk }: { label: string; sk: SortKey }) => (
    <button onClick={() => setSortKey(sk)}
      className="flex items-center gap-0.5 text-xs font-semibold cursor-pointer"
      style={{ color: sortKey === sk ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
      {label} <ArrowUpDown size={10} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>전종목 데이터 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--accent-blue)' }}>{sorted.length}개</span>
        <span> / 전체 {data.length}개</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p className="text-sm">필터 조건에 맞는 종목이 없습니다.</p>
          <p className="text-xs mt-1">필터를 변경하거나 초기화해 보세요.</p>
        </div>
      ) : (
      <div className="rounded-xl overflow-auto max-h-[70vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table className="w-full min-w-[950px] sticky-header">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="w-8 px-2 py-2.5" />
                <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                <th className="px-3 py-2.5"><SortBtn label="점수" sk="score" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="괴리비율" sk="undervalue" /></th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>순이익증감(억)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>시총증감(억)</th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="시총" sk="marketCap" /></th>
                <th className="px-3 py-2.5 text-right"><SortBtn label="PER(TTM)" sk="per" /></th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>ROE</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>판정</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock, i) => {
                const vi = getVerdictInfo(stock.verdict);
                return (
                  <tr key={stock.code} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-2 py-3 text-center">
                      <FavoriteButton active={isFavorite(stock.code)} onClick={() => toggle(stock.code)} size={14} />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/stocks/${stock.code}`} className="block">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {stock.code} · {stock.market.toUpperCase()}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-black" style={{ color: vi.color }}>{stock.score}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-sm font-bold" style={{ color: (stock.niGapRatio ?? stock.undervalueIndex ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {stock.niGapRatio != null ? formatPct(stock.niGapRatio) : stock.undervalueIndex != null ? formatPct(stock.undervalueIndex) : 'N/A'}
                      </div>
                      {stock.turnaround && <div className="text-[10px] font-bold" style={{ color: '#22c55e' }}>흑자전환</div>}
                      {stock.deficitTurn && <div className="text-[10px] font-bold" style={{ color: '#ef4444' }}>적자전환</div>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: (stock.niChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {stock.niChange != null ? (stock.niChange >= 0 ? '+' : '') + stock.niChange.toLocaleString() : 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: (stock.mcapChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {stock.mcapChange != null ? (stock.mcapChange >= 0 ? '+' : '') + stock.mcapChange.toLocaleString() : 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatBillion(stock.marketCap)}</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {stock.perTtm ? stock.perTtm + '배' : 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {stock.roe ? stock.roe.toFixed(1) + '%' : 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="verdict-badge" style={{ background: `${vi.color}18`, color: vi.color }}>
                        {vi.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
      )}
    </div>
  );
}
