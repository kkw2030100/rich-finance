'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { fetchScores, ScoreItem, formatBillion, formatPct, getVerdictInfo } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';

type SortKey = 'score' | 'undervalue' | 'per' | 'marketCap';

const TIERS = [
  { key: 'all', label: '전체' },
  { key: '초대형주', label: '초대형 5조+' },
  { key: '대형주', label: '대형 1~5조' },
  { key: '중형주', label: '중형 3천억~1조' },
  { key: '소형주', label: '소형 ~3천억' },
];

export function StockTableLive() {
  const [data, setData] = useState<ScoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('undervalue');
  const [filterMarket, setFilterMarket] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const { toggle, isFavorite, favorites } = useFavorites();

  useEffect(() => {
    setLoading(true);
    fetchScores({ market: filterMarket, sort: sortKey, limit: 200, tier: filterTier })
      .then(res => { setData(res.data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filterMarket, sortKey, filterTier]);

  const filtered = showFavOnly ? data.filter(s => favorites.includes(s.code)) : data;

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

  if (error) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-red)' }}>
        <p className="text-sm" style={{ color: 'var(--accent-red)' }}>데이터 로딩 실패: {error}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>mock 데이터로 전환하려면 페이지를 새로고침하세요</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {['all', 'kospi', 'kosdaq'].map(m => (
          <button key={m} onClick={() => setFilterMarket(m)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: filterMarket === m ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
              color: filterMarket === m ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}>
            {m === 'all' ? '전체' : m.toUpperCase()}
          </button>
        ))}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
        {TIERS.map(t => (
          <button key={t.key} onClick={() => setFilterTier(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: filterTier === t.key ? 'rgba(168,85,247,0.15)' : 'var(--bg-card)',
              color: filterTier === t.key ? '#a855f7' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}>
            {t.label}
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
          관심종목{favorites.length > 0 && ` (${favorites.length})`}
        </button>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {filtered.length}개 종목
        </span>
      </div>

      {/* Table */}
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
              {filtered.map((stock, i) => {
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
    </div>
  );
}
