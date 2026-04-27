'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';

export interface Holding {
  id: string;
  ticker: string;
  buy_price: number;
  quantity: number | null;
  buy_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface NewHolding {
  ticker: string;
  buy_price: number;
  quantity?: number;
  buy_date?: string;
  notes?: string;
}

export function useHoldings() {
  const { user, loading: authLoading } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  const fetchHoldings = useCallback(async () => {
    if (!user) {
      setHoldings([]);
      setLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from('user_holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setHoldings((data as Holding[]) || []);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchHoldings();
  }, [authLoading, fetchHoldings]);

  const add = useCallback(async (h: NewHolding) => {
    if (!user) return null;
    const { data, error } = await supabase.from('user_holdings').insert({
      user_id: user.id,
      ticker: h.ticker,
      buy_price: h.buy_price,
      quantity: h.quantity ?? null,
      buy_date: h.buy_date ?? null,
      notes: h.notes ?? null,
    }).select().single();
    if (!error && data) {
      setHoldings(prev => [data as Holding, ...prev]);
      return data as Holding;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = useCallback(async (id: string, patch: Partial<NewHolding>) => {
    if (!user) return;
    await supabase.from('user_holdings').update({
      ...patch, updated_at: new Date().toISOString(),
    }).eq('id', id);
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...patch } as Holding : h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const remove = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('user_holdings').delete().eq('id', id);
    setHoldings(prev => prev.filter(h => h.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const findByTicker = useCallback((ticker: string) => {
    return holdings.find(h => h.ticker === ticker);
  }, [holdings]);

  return { holdings, loaded, add, update, remove, findByTicker, refresh: fetchHoldings };
}
