/**
 * 단순 SWR 패턴 — localStorage 기반 stale-while-revalidate
 *
 * cachedFetch(key, fetcher, ttl?):
 *   - cached: 즉시 사용 가능한 캐시 데이터 (없으면 null)
 *   - promise: 백그라운드에서 fresh 데이터 fetch + 캐시 갱신
 *
 * UI 패턴:
 *   const { cached, promise } = cachedFetch('key', fetcher);
 *   if (cached) setState(cached);  // 즉시 페인트
 *   promise.then(fresh => setState(fresh));  // 백그라운드 업데이트
 */

const NS = 'screener:';

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60 * 60 * 1000  // 기본 1시간
): { cached: T | null; promise: Promise<T> } {
  let cached: T | null = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(NS + key);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < ttlMs) cached = data as T;
      }
    } catch {}
  }
  const promise = fetcher().then(data => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NS + key, JSON.stringify({ data, ts: Date.now() }));
      } catch {
        // QuotaExceeded 등 — 무시
      }
    }
    return data;
  });
  return { cached, promise };
}

export function clearCache(prefix?: string) {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(window.localStorage);
  for (const k of keys) {
    if (k.startsWith(NS) && (!prefix || k.includes(prefix))) {
      window.localStorage.removeItem(k);
    }
  }
}
