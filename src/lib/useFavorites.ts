'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rich-finance-favorites';

function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeFavorites(tickers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setLoaded(true);
  }, []);

  const toggle = useCallback((ticker: string) => {
    setFavorites(prev => {
      const next = prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker];
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((ticker: string) => {
    return favorites.includes(ticker);
  }, [favorites]);

  return { favorites, toggle, isFavorite, loaded };
}
