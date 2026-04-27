'use client';

import { useState, useEffect } from 'react';
import { useHoldings } from '@/lib/useHoldings';
import { cachedFetch } from '@/lib/swrCache';

interface BreakoutResp {
  data: { code: string; name: string }[];
  asOf?: string;
}

/**
 * 보유 종목 중 추격 위험(late_stage / late_stage_daily) 단계 진입한 것 카운트.
 * 사이드바 알림 배지에 사용.
 */
export function useSellAlerts() {
  const { holdings } = useHoldings();
  const [alertCount, setAlertCount] = useState(0);
  const [alertCodes, setAlertCodes] = useState<string[]>([]);

  useEffect(() => {
    if (holdings.length === 0) {
      setAlertCount(0);
      setAlertCodes([]);
      return;
    }

    const types = ['late_stage', 'late_stage_daily'];
    const handles = types.map(t => cachedFetch<BreakoutResp>(`breakout:${t}`,
      () => fetch(`/api/breakout?limit=300&type=${t}`).then(r => r.json()).catch(() => ({ data: [] }))
    ));

    // 캐시가 있으면 즉시 카운트
    const compute = (results: BreakoutResp[]) => {
      const lateCodes = new Set<string>();
      for (const r of results) {
        for (const item of r?.data || []) lateCodes.add(item.code);
      }
      const myLate = holdings.filter(h => lateCodes.has(h.ticker)).map(h => h.ticker);
      setAlertCount(myLate.length);
      setAlertCodes(myLate);
    };

    const cachedResults = handles.map(h => h.cached).filter((x): x is BreakoutResp => x !== null);
    if (cachedResults.length === types.length) {
      compute(cachedResults);
    }

    // 백그라운드 fresh fetch
    Promise.all(handles.map(h => h.promise)).then(compute);
  }, [holdings]);

  return { alertCount, alertCodes };
}
