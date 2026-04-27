'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { NewHolding } from '@/lib/useHoldings';

interface SearchResult {
  code: string;
  name: string;
  market: string;
}

export function AddHoldingModal({ onClose, onAdd, initial }: {
  onClose: () => void;
  onAdd: (h: NewHolding) => Promise<void>;
  initial?: { code: string; name: string; market: string };
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(initial ?? null);
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // 자동완성
  useEffect(() => {
    if (selected || !query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(query.trim())}&limit=8`)
        .then(r => r.json())
        .then(d => setResults(d.data || []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, selected]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError('종목을 선택해주세요.');
      return;
    }
    const price = parseFloat(buyPrice.replace(/,/g, ''));
    if (!price || price <= 0) {
      setError('매수가를 정확히 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({
        ticker: selected.code,
        buy_price: price,
        quantity: quantity ? parseInt(quantity.replace(/,/g, '')) : undefined,
        buy_date: buyDate || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>보유 종목 추가</h2>
          <button onClick={onClose} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 종목 검색 */}
          <div className="relative">
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>종목 *</label>
            {selected ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{selected.code} · {selected.market.toUpperCase()}</div>
                </div>
                <button type="button" onClick={() => { setSelected(null); setQuery(''); }}
                  className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>변경</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="종목명 또는 코드 검색"
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
                </div>
                {results.length > 0 && (
                  <div className="mt-1 rounded-lg overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {results.map((r, i) => (
                      <button key={r.code} type="button" onClick={() => { setSelected(r); setQuery(''); }}
                        className="w-full text-left px-3 py-2 transition-colors cursor-pointer"
                        style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.code} · {r.market.toUpperCase()}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 매수가 */}
          <div>
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>매수가 *</label>
            <input type="text" value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
              placeholder={selected?.market === 'us' ? '예: 150.50' : '예: 70000'}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
          </div>

          {/* 수량 + 날짜 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>수량 (선택)</label>
              <input type="text" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>매수일 (선택)</label>
              <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>메모 (선택)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="매수 이유, 목표가 등"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
          </div>

          {error && <div className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              취소
            </button>
            <button type="submit" disabled={submitting || !selected}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--accent-blue)', color: 'white', opacity: (submitting || !selected) ? 0.5 : 1 }}>
              {submitting && <Loader2 size={12} className="animate-spin" />}
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
