'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';

const STORAGE_KEY = 'rich-finance-favorites';

function readLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(tickers: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export function useFavorites() {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  // 초기 로드 + 마이그레이션
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // 비로그인: localStorage만
      setFavorites(readLocal());
      setLoaded(true);
      return;
    }

    // 로그인: Supabase에서 fetch
    (async () => {
      const { data } = await supabase
        .from('user_favorites')
        .select('ticker')
        .eq('user_id', user.id);

      let tickers = (data || []).map(r => r.ticker);

      // 첫 로그인 시 localStorage 마이그레이션
      const localTickers = readLocal();
      if (localTickers.length > 0 && tickers.length === 0) {
        const rows = localTickers.map(ticker => ({ user_id: user.id, ticker }));
        await supabase.from('user_favorites').upsert(rows, { onConflict: 'user_id,ticker' });
        tickers = localTickers;
        // 마이그레이션 완료 후 localStorage 비움
        localStorage.removeItem(STORAGE_KEY);
      }

      setFavorites(tickers);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const toggle = useCallback(async (ticker: string) => {
    if (!user) {
      // 비로그인: localStorage 작동
      setFavorites(prev => {
        const next = prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker];
        writeLocal(next);
        return next;
      });
      return;
    }

    // 로그인: Supabase 토글
    const isFav = favorites.includes(ticker);
    setFavorites(prev => isFav ? prev.filter(t => t !== ticker) : [...prev, ticker]);

    if (isFav) {
      await supabase.from('user_favorites').delete()
        .eq('user_id', user.id).eq('ticker', ticker);
    } else {
      await supabase.from('user_favorites').upsert(
        { user_id: user.id, ticker },
        { onConflict: 'user_id,ticker' }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, favorites]);

  const isFavorite = useCallback((ticker: string) => favorites.includes(ticker), [favorites]);

  return { favorites, toggle, isFavorite, loaded };
}
