'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart3, Layers, Users, Rocket, Search, X } from 'lucide-react';
import { fetchScores, ScoreItem, formatMoney, formatPrice, formatPct, deriveTier, getCountry, isPreferredStock } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';
import { FavoriteButton } from '@/components/common/FavoriteButton';
import { StockTableLive } from '@/components/stocks/StockTableLive';

type Mode = 'all' | 'total' | 'ttm' | 'gap' | 'composite' | 'analyst' | 'breakout';

const MODES: { key: Mode; label: string; desc: string; icon: typeof Layers; color: string }[] = [
  { key: 'all', label: '전종목', desc: '시장/시총/관심종목 자유 탐색', icon: Search, color: 'var(--accent-blue)' },
  { key: 'breakout', label: '본격 상승', desc: 'Stage 1→2 진입부터 본격 추세 진행까지 — 한 종목의 모든 단계를 배지로 동시 표시', icon: Rocket, color: 'var(--accent-red)' },
  { key: 'total', label: '종합 저평가', desc: '모든 기준을 종합한 점수', icon: Layers, color: 'var(--accent-blue)' },
  { key: 'ttm', label: '지금 싼 종목', desc: '벌고 있는 돈에 비해 가격이 싼 종목', icon: DollarSign, color: 'var(--accent-green)' },
  { key: 'gap', label: '아직 덜 오른 종목', desc: '돈을 더 잘 벌게 됐는데 가격이 안 오른 종목', icon: TrendingUp, color: 'var(--accent-purple)' },
  { key: 'composite', label: '싸고 좋은 기업', desc: '가격도 싸고 기업 체질도 좋은 종목', icon: BarChart3, color: 'var(--accent-yellow)' },
  { key: 'analyst', label: '전문가 매수의견', desc: '증권사 목표가 대비 현재가가 낮은 종목', icon: Users, color: 'var(--accent-blue)' },
];

// 시그널 단계 (4그룹)
type Stage = 'early' | 'rapid' | 'steady' | 'late';
const STAGE_OF_TYPE: Record<string, Stage> = {
  confluence: 'early', daily: 'early', weekly: 'early',
  mid_rapid: 'rapid', mid_steady: 'steady', late_stage: 'late',
};
const STAGE_META: Record<Stage, { label: string; emoji: string; color: string; bg: string }> = {
  early:  { label: '초기',  emoji: '🌱', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  rapid:  { label: '급등',  emoji: '⚡', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  steady: { label: '상승',  emoji: '🐢', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  late:   { label: '위험',  emoji: '⚠️', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
};

const COUNTRIES: { key: string; label: string; disabled?: boolean }[] = [
  { key: 'kr', label: '🇰🇷 한국' },
  { key: 'us', label: '🇺🇸 미국' },
  { key: 'jp', label: '🇯🇵 일본', disabled: true },
  { key: 'cn', label: '🇨🇳 중국', disabled: true },
];

const MARKETS = [
  { key: 'kospi', label: 'KOSPI' },
  { key: 'kosdaq', label: 'KOSDAQ' },
  { key: 'us', label: 'US' },
];

const TIERS = [
  { key: '초대형주', label: '초대형 5조+' },
  { key: '대형주', label: '대형 1~5조' },
  { key: '중형주', label: '중형 3천억~1조' },
  { key: '소형주', label: '소형 ~3천억' },
  { key: '미국주식', label: '미국' },
];

const DEFAULT_COUNTRIES = ['kr'];
const DEFAULT_MARKETS = ['kospi'];
const DEFAULT_TIERS = ['초대형주'];
const DEFAULT_MODE: Mode = 'total';
const DEFAULT_EXCLUDE_PREFERRED = true;

interface StagedSignal {
  code: string; name: string; market: string;
  price: number | null; changePct: number | null; marketCap: number | null;
  stages: Stage[];                  // 종목이 속한 단계들 (uniq)
  signalTypes: string[];            // 원본 signal_type들 (confluence/daily/weekly/mid_rapid/mid_steady/late_stage)
  scoreByType: Record<string, number>;
  maxScore: number;
}

interface ScreenerItem {
  code: string; name: string; market: string;
  price: number; changePct: number; marketCap: number; tier: string;
  perTtm: number | null; porTtm: number | null; psrTtm: number | null;
  ttmNi: number; ttmOp: number; ttmRevenue: number;
  mcapChange: number | null;
  niChange: number | null; niGapRatio: number | null;
  turnaround: boolean; deficitTurn: boolean;
  uiQuadrant: string | null; uiIndex: number | null;
  uiValue: number | null; uiQuality: number | null;
  score: number; verdict: string;
  targetPriceWeighted?: number; upside?: number;
  analystCount?: number; rating?: number;
  currentPrice?: number;
}

function getQuadrantColor(q: string | null) {
  switch (q) {
    case '저평가+고품질': return '#22c55e';
    case '고평가+고품질': return '#3b82f6';
    case '저평가+저품질': return '#f97316';
    case '고평가+저품질': return '#ef4444';
    default: return '#6b7280';
  }
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function ScreenerLive() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [allScoreData, setAllScoreData] = useState<ScoreItem[]>([]);
  const [stagedSignals, setStagedSignals] = useState<StagedSignal[]>([]);
  const [breakoutMeta, setBreakoutMeta] = useState<{ asOf: string | null }>({ asOf: null });
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [breakoutLoading, setBreakoutLoading] = useState(false);
  const [modeData, setModeData] = useState<Record<string, ScreenerItem[]>>({ total: [], ttm: [], gap: [], composite: [], analyst: [] });
  const [dataLoaded, setDataLoaded] = useState(false);

  const [countries, setCountries] = useState<string[]>(DEFAULT_COUNTRIES);
  const [markets, setMarkets] = useState<string[]>(DEFAULT_MARKETS);
  const [tiers, setTiers] = useState<string[]>(DEFAULT_TIERS);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [excludePreferred, setExcludePreferred] = useState(DEFAULT_EXCLUDE_PREFERRED);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);

  const [hydrated, setHydrated] = useState(false);
  const prevModeRef = useRef<Mode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { toggle: toggleFav, isFavorite, favorites } = useFavorites();

  // ---- URL 하이드레이션 (마운트 1회) ----
  useEffect(() => {
    const m = searchParams.get('mode') as Mode | null;
    if (m && MODES.find(mm => mm.key === m)) setMode(m);
    const c = searchParams.get('c');
    if (c) setCountries(c.split(',').filter(Boolean));
    const mk = searchParams.get('m');
    if (mk) setMarkets(mk.split(',').filter(Boolean));
    const t = searchParams.get('t');
    if (t) setTiers(t.split(',').filter(Boolean));
    if (searchParams.get('fav') === '1') setShowFavOnly(true);
    if (searchParams.get('pref') === '1') setExcludePreferred(false);  // pref=1 → 우선주 포함 (default off)
    const sf = searchParams.get('stage');
    if (sf === 'early' || sf === 'rapid' || sf === 'steady' || sf === 'late') setStageFilter(sf);
    const q = searchParams.get('q');
    if (q) setSearch(q);
    prevModeRef.current = (m && MODES.find(mm => mm.key === m)) ? m : DEFAULT_MODE;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 모든 모드 데이터 prefetch (마운트 1회) ----
  useEffect(() => {
    Promise.all([
      // KR + US 동시 fetch — 전종목 universe
      fetchScores({ limit: 3000 }).then(r => r.data || []).catch(() => [] as ScoreItem[]),
      fetchScores({ market: 'us', limit: 5000 }).then(r => r.data || []).catch(() => [] as ScoreItem[]),
      fetch('/api/undervalued?mode=total&limit=100').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/undervalued?mode=ttm&limit=100').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/undervalued?mode=gap&limit=100').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/undervalued?mode=composite&limit=100').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/undervalued?mode=analyst&limit=100').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([scoresKR, scoresUS, total, ttm, gap, composite, analyst]) => {
      setAllScoreData([...scoresKR, ...scoresUS]);
      setModeData({
        total: total.data || [],
        ttm: ttm.data || [],
        gap: gap.data || [],
        composite: composite.data || [],
        analyst: analyst.data || [],
      });
      setDataLoaded(true);
    });
  }, []);

  // ---- URL 동기화 (state → URL) ----
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (mode !== DEFAULT_MODE) params.set('mode', mode);
    if (!arraysEqual(countries, DEFAULT_COUNTRIES)) params.set('c', countries.join(','));
    if (!arraysEqual(markets, DEFAULT_MARKETS)) params.set('m', markets.join(','));
    if (!arraysEqual(tiers, DEFAULT_TIERS)) params.set('t', tiers.join(','));
    if (showFavOnly) params.set('fav', '1');
    if (excludePreferred !== DEFAULT_EXCLUDE_PREFERRED) params.set('pref', '1');
    if (stageFilter !== 'all') params.set('stage', stageFilter);
    if (search.trim()) params.set('q', search.trim());

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      router.push(url, { scroll: false });
    } else {
      router.replace(url, { scroll: false });
    }
    prevModeRef.current = mode;
  }, [mode, countries, markets, tiers, showFavOnly, excludePreferred, stageFilter, search, hydrated, pathname, router]);

  // 본격 상승 모드 진입 시 6가지 signal_type 통합 fetch (마운트 후)
  useEffect(() => {
    if (!hydrated) return;
    if (mode !== 'breakout') return;
    if (stagedSignals.length > 0) return;  // 이미 받았으면 skip
    setBreakoutLoading(true);
    const types = ['confluence', 'daily', 'weekly', 'mid_rapid', 'mid_steady', 'late_stage'];
    Promise.all(types.map(t =>
      fetch(`/api/breakout?limit=300&type=${t}`).then(r => r.json()).catch(() => ({ data: [] }))
    )).then(results => {
      // 종목별로 단계 합치기
      const byCode = new Map<string, StagedSignal>();
      let asOf: string | null = null;
      for (let i = 0; i < types.length; i++) {
        const t = types[i];
        const stage = STAGE_OF_TYPE[t];
        if (results[i]?.asOf) asOf = results[i].asOf;
        for (const item of results[i].data || []) {
          let entry = byCode.get(item.code);
          if (!entry) {
            entry = {
              code: item.code, name: item.name, market: item.market,
              price: item.price, changePct: item.changePct, marketCap: item.marketCap,
              stages: [], signalTypes: [], scoreByType: {}, maxScore: 0,
            };
            byCode.set(item.code, entry);
          }
          if (!entry.stages.includes(stage)) entry.stages.push(stage);
          entry.signalTypes.push(t);
          entry.scoreByType[t] = item.score;
          entry.maxScore = Math.max(entry.maxScore, item.score || 0);
        }
      }
      setStagedSignals(Array.from(byCode.values()));
      setBreakoutMeta({ asOf });
    }).finally(() => setBreakoutLoading(false));
  }, [mode, hydrated, stagedSignals.length]);

  // ---- 외부 클릭으로 dropdown 닫기 ----
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function passes(item: { code: string; name: string; market: string; marketCap?: number | null; tier?: string }) {
    const itemCountry = getCountry(item.market);
    const itemMarket = (item.market || '').toLowerCase();
    const itemTier = item.tier || deriveTier(item.marketCap ?? null, item.market);

    if (countries.length > 0 && !countries.includes(itemCountry)) return false;
    if (markets.length > 0 && !markets.includes(itemMarket)) return false;
    if (tiers.length > 0) {
      if (!itemTier) return false;  // 시총 결측 종목은 tier 필터 통과 못함
      if (!tiers.includes(itemTier)) return false;
    }
    if (showFavOnly && !favorites.includes(item.code)) return false;
    if (excludePreferred && isPreferredStock(item.code, item.market)) return false;
    return true;
  }

  const filteredStaged = useMemo(() => {
    return stagedSignals.filter(s => {
      if (!passes(s)) return false;
      if (stageFilter !== 'all' && !s.stages.includes(stageFilter)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedSignals, stageFilter, countries, markets, tiers, showFavOnly, excludePreferred, favorites]);
  const filteredData = useMemo(
    () => (modeData[mode] || []).filter(passes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modeData, mode, countries, markets, tiers, showFavOnly, excludePreferred, favorites]
  );

  // ---- 모드별 결과 개수 (badge) ----
  const counts = useMemo(() => {
    const result: Record<Mode, number> = {
      all: allScoreData.filter(passes).length,
      breakout: stagedSignals.filter(passes).length,
      total: (modeData.total || []).filter(passes).length,
      ttm: (modeData.ttm || []).filter(passes).length,
      gap: (modeData.gap || []).filter(passes).length,
      composite: (modeData.composite || []).filter(passes).length,
      analyst: (modeData.analyst || []).filter(passes).length,
    };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allScoreData, stagedSignals, modeData, countries, markets, tiers, showFavOnly, excludePreferred, favorites]);

  // ---- 단계별 카운트 (필터 토글 배지) ----
  const stageCounts = useMemo(() => {
    const base = { all: 0, early: 0, rapid: 0, steady: 0, late: 0 };
    const passing = stagedSignals.filter(passes);
    base.all = passing.length;
    for (const s of passing) {
      for (const stage of s.stages) base[stage]++;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedSignals, countries, markets, tiers, showFavOnly, excludePreferred, favorites]);

  // ---- 자동완성 (debounced API call, 필터와 무관) ----
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(q)}&limit=10`)
        .then(r => r.json())
        .then(d => setSearchResults(d.data || []))
        .catch(() => setSearchResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const suggestions = searchResults;

  const onSearchEnter = () => {
    if (suggestions.length === 0) return;
    setShowDropdown(false);
    router.push(`/stocks/${suggestions[0].code}`);
  };

  const current = MODES.find(m => m.key === mode)!;
  const isDirty =
    !arraysEqual(countries, DEFAULT_COUNTRIES) ||
    !arraysEqual(markets, DEFAULT_MARKETS) ||
    !arraysEqual(tiers, DEFAULT_TIERS) ||
    showFavOnly || excludePreferred !== DEFAULT_EXCLUDE_PREFERRED || search.trim() !== '';

  const enabledCountries = COUNTRIES.filter(c => !c.disabled).map(c => c.key);
  const allCountriesSelected = enabledCountries.length > 0 && enabledCountries.every(k => countries.includes(k));
  const allMarketsSelected = MARKETS.every(m => markets.includes(m.key));
  const allTiersSelected = TIERS.every(t => tiers.includes(t.key));

  const Chip = ({ active, disabled, color, onClick, children }: {
    active: boolean; disabled?: boolean; color: string;
    onClick: () => void; children: React.ReactNode;
  }) => (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
      style={{
        background: active ? `${color}20` : 'var(--bg-card)',
        color: disabled ? 'var(--text-muted)' : active ? color : 'var(--text-secondary)',
        border: `1px solid ${active ? `${color}60` : 'var(--border)'}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );

  return (
    <div>
      {/* 검색 바 + 자동완성 */}
      <div className="flex justify-end mb-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSearchEnter();
              if (e.key === 'Escape') setShowDropdown(false);
            }}
            placeholder="종목명 또는 코드 검색"
            className="w-full pl-9 pr-8 py-2 rounded-lg text-xs"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setShowDropdown(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer z-10"
              style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          )}
          {showDropdown && suggestions.length > 0 && (
            <div ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl overflow-hidden z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {suggestions.map((s, i) => (
                <Link key={s.code} href={`/stocks/${s.code}`}
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center justify-between px-3 py-2 transition-colors"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    background: i === 0 ? 'var(--bg-secondary)' : 'transparent',
                  }}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.code} · {s.market.toUpperCase()}</span>
                  </div>
                </Link>
              ))}
              <div className="px-3 py-1.5 text-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Enter = 첫번째 종목 이동 · Esc = 닫기
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 계층 필터: 국가 → 시장 → 시총 */}
      <div className="rounded-xl p-3 mb-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold w-12" style={{ color: 'var(--text-muted)' }}>국가</span>
          <Chip active={allCountriesSelected} color="#3b82f6"
            onClick={() => setCountries(allCountriesSelected ? [] : COUNTRIES.filter(c => !c.disabled).map(c => c.key))}>
            전체
          </Chip>
          {COUNTRIES.map(c => (
            <Chip key={c.key}
              active={countries.includes(c.key)}
              disabled={c.disabled}
              color="#3b82f6"
              onClick={() => setCountries(toggle(countries, c.key))}>
              {c.label}{c.disabled && ' (예정)'}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold w-12" style={{ color: 'var(--text-muted)' }}>시장</span>
          <Chip active={allMarketsSelected} color="#a855f7"
            onClick={() => setMarkets(allMarketsSelected ? [] : MARKETS.map(m => m.key))}>
            전체
          </Chip>
          {MARKETS.map(m => (
            <Chip key={m.key}
              active={markets.includes(m.key)}
              color="#a855f7"
              onClick={() => setMarkets(toggle(markets, m.key))}>
              {m.label}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold w-12" style={{ color: 'var(--text-muted)' }}>시총</span>
          <Chip active={allTiersSelected} color="#22c55e"
            onClick={() => setTiers(allTiersSelected ? [] : TIERS.map(t => t.key))}>
            전체
          </Chip>
          {TIERS.map(t => (
            <Chip key={t.key}
              active={tiers.includes(t.key)}
              color="#22c55e"
              onClick={() => setTiers(toggle(tiers, t.key))}>
              {t.label}
            </Chip>
          ))}
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
          <Chip
            active={showFavOnly}
            color="#facc15"
            onClick={() => setShowFavOnly(!showFavOnly)}>
            ⭐ 관심종목{favorites.length > 0 && ` (${favorites.length})`}
          </Chip>
          <Chip
            active={excludePreferred}
            color="#ef4444"
            onClick={() => setExcludePreferred(!excludePreferred)}>
            우선주 제외
          </Chip>
          {isDirty && (
            <button onClick={() => {
              setCountries(DEFAULT_COUNTRIES);
              setMarkets(DEFAULT_MARKETS);
              setTiers(DEFAULT_TIERS);
              setShowFavOnly(false);
              setExcludePreferred(DEFAULT_EXCLUDE_PREFERRED);
              setSearch('');
            }}
              className="ml-auto px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer"
              style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs (with badge) */}
      <div className="flex gap-2 mb-1 overflow-x-auto">
        {MODES.map(m => {
          const count = counts[m.key];
          const active = mode === m.key;
          return (
            <button key={m.key} onClick={() => setMode(m.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              style={{
                background: active ? `${m.color}15` : 'var(--bg-card)',
                color: active ? m.color : 'var(--text-secondary)',
                border: `1px solid ${active ? `${m.color}40` : 'var(--border)'}`,
              }}>
              <m.icon size={16} />
              {m.label}
              {dataLoaded && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? `${m.color}25` : 'var(--bg-secondary)',
                    color: count > 0 ? (active ? m.color : 'var(--text-secondary)') : 'var(--text-muted)',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{current.desc}</p>

      {mode !== 'all' && mode !== 'breakout' && (
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          ※ 큐레이션 모드는 한국 종목 기반입니다. 미국 종목은 &apos;전종목&apos; 또는 &apos;본격 상승 초기&apos; 탭에서 확인하세요.
        </p>
      )}

      {mode === 'all' ? (
        <StockTableLive
          data={allScoreData}
          loading={!dataLoaded}
          countries={countries}
          markets={markets}
          tiers={tiers}
          showFavOnly={showFavOnly}
          excludePreferred={excludePreferred}
        />
      ) : !dataLoaded ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>스크리닝 중...</span>
        </div>
      ) : mode === 'breakout' ? (
        <>
          {/* 단계 필터 토글 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {([
              { key: 'all' as const, emoji: '📊', label: '전체', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
              { key: 'early' as const, ...STAGE_META.early, label: '상승 초기' },
              { key: 'rapid' as const, ...STAGE_META.rapid, label: '급등 중' },
              { key: 'steady' as const, ...STAGE_META.steady, label: '상승 중' },
              { key: 'late' as const, ...STAGE_META.late, label: '위험 단계' },
            ]).map(t => {
              const cnt = stageCounts[t.key];
              const active = stageFilter === t.key;
              return (
                <button key={t.key} onClick={() => setStageFilter(t.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    background: active ? t.bg : 'var(--bg-card)',
                    color: active ? t.color : 'var(--text-secondary)',
                    border: `1px solid ${active ? t.color + '60' : 'var(--border)'}`,
                  }}>
                  {('emoji' in t ? t.emoji : '')} {t.label}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: active ? t.color + '30' : 'var(--bg-secondary)',
                             color: cnt > 0 ? (active ? t.color : 'var(--text-secondary)') : 'var(--text-muted)',
                             minWidth: '20px', textAlign: 'center' }}>
                    {cnt}
                  </span>
                </button>
              );
            })}
            {breakoutLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
          </div>

          <div className="mb-3 text-xs flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: current.color }}>{filteredStaged.length}개</span>
            <span>/ 전체 {stagedSignals.length}개</span>
            {breakoutMeta.asOf && <span>· 기준일 {breakoutMeta.asOf}</span>}
          </div>

          {filteredStaged.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Rocket size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{stagedSignals.length === 0 ? '현재 본격 상승 신호 종목이 없습니다.' : '필터 조건에 맞는 종목이 없습니다.'}</p>
              <p className="text-xs mt-1">{stagedSignals.length === 0 ? '매일 16:30 한국 시장 마감 후 자동 스캔됩니다.' : '필터를 변경하거나 초기화해 보세요.'}</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-auto max-h-[70vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <table className="w-full min-w-[800px] sticky-header">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                    <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>단계</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>최고 점수</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaged.sort((a, b) => b.maxScore - a.maxScore).map((s, i) => (
                    <tr key={s.code} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-2 py-3 text-center">
                        <FavoriteButton active={isFavorite(s.code)} onClick={() => toggleFav(s.code)} size={14} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/stocks/${s.code}`}>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {s.code} · {s.market}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(['early','rapid','steady','late'] as Stage[]).filter(st => s.stages.includes(st)).map(st => {
                            const meta = STAGE_META[st];
                            return (
                              <span key={st} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: meta.bg, color: meta.color }}>
                                {meta.emoji} {meta.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-black" style={{ color: s.maxScore >= 16 ? 'var(--accent-red)' : s.maxScore >= 13 ? 'var(--accent-yellow)' : 'var(--text-primary)' }}>
                          {s.maxScore}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        {formatMoney(s.marketCap, s.market)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatPrice(s.price, s.market)}
                        </div>
                        {s.changePct != null && (
                          <div className="text-[10px] flex items-center justify-end gap-0.5"
                            style={{ color: s.changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {s.changePct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {formatPct(s.changePct)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-xl p-4 text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>📊 본격 상승 — 단계 해석 (한 종목이 여러 단계에 동시 속할 수 있음)</div>
            <div className="space-y-1">
              <div>· <strong style={{ color: STAGE_META.early.color }}>🌱 상승 초기</strong> — Stage 1→2 진입 (주봉 베이스 돌파 / 일봉 MA60 돌파). 분할 매수 첫 진입</div>
              <div>· <strong style={{ color: STAGE_META.steady.color }}>🐢 상승 중</strong> — 20W MA 8주↑ 정배열. 메인 매수 시점 (백테스트 12w 중간 +2.7%, 승률 56%)</div>
              <div>· <strong style={{ color: STAGE_META.rapid.color }}>⚡ 급등 중</strong> — 5W MA 단기 강세. 추격 매수 (12w 중간 +1.4%, +30% 도달 22%)</div>
              <div>· <strong style={{ color: STAGE_META.late.color }}>⚠️ 위험 단계</strong> — Parabolic 위험 (12w 중간 -5.4%, -10%↓ 손실률 44%). 매수 X, 보유 시 수익실현 검토</div>
            </div>
            <div className="mt-3 pt-2 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              한 종목이 [상승 초기 + 상승 중] 동시 → 추세 확립 + 안정 진입. [급등 + 위험] 동시 → 강한 모멘텀이지만 추격 위험.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: current.color }}>{filteredData.length}개</span>
            <span> / 전체 {(modeData[mode] || []).length}개</span>
          </div>

          {filteredData.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <p className="text-sm">필터 조건에 맞는 종목이 없습니다.</p>
              <p className="text-xs mt-1">필터를 변경하거나 초기화해 보세요.</p>
            </div>
          ) : (
          <div className="rounded-xl overflow-auto max-h-[70vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <table className="w-full min-w-[800px] sticky-header">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="text-left px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>종목</th>
                    {mode === 'ttm' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PER(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>POR(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PSR(TTM)</th>
                      </>
                    )}
                    {mode === 'gap' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>순이익 증감</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총 증감</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>괴리율</th>
                      </>
                    )}
                    {mode === 'composite' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>Value</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>Quality</th>
                        <th className="text-center px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>4분면</th>
                      </>
                    )}
                    {mode === 'total' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>PER(TTM)</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>괴리율</th>
                      </>
                    )}
                    {mode === 'analyst' && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>목표가</th>
                        <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>상승여력</th>
                        <th className="text-center px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>투자의견</th>
                      </>
                    )}
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>시총</th>
                    <th className="text-right px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>현재가</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((stock, i) => (
                    <tr key={stock.code} className="card-hover" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-2 py-3 text-center">
                        <FavoriteButton active={isFavorite(stock.code)} onClick={() => toggleFav(stock.code)} size={14} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/stocks/${stock.code}`}>
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stock.name}</div>
                            {stock.turnaround && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>흑자전환</span>
                            )}
                            {stock.deficitTurn && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>적자전환</span>
                            )}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stock.code} · {stock.market.toUpperCase()} · {stock.tier}</div>
                        </Link>
                      </td>

                      {mode === 'ttm' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.perTtm ? stock.perTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {stock.porTtm ? stock.porTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {stock.psrTtm ? stock.psrTtm + '배' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'gap' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.niChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niChange != null ? (stock.niChange >= 0 ? '+' : '') + formatMoney(stock.niChange, stock.market) : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: (stock.mcapChange ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.mcapChange != null ? (stock.mcapChange >= 0 ? '+' : '') + formatMoney(stock.mcapChange, stock.market) : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-black" style={{ color: (stock.niGapRatio ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niGapRatio != null ? (stock.niGapRatio > 0 ? '+' : '') + stock.niGapRatio + '%' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'composite' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.uiValue ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.uiQuality ?? 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {stock.uiQuadrant && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{ background: `${getQuadrantColor(stock.uiQuadrant)}15`, color: getQuadrantColor(stock.uiQuadrant) }}>
                                {stock.uiQuadrant === '저평가+고품질' && '★ '}{stock.uiQuadrant}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {mode === 'total' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                            {stock.perTtm ? stock.perTtm + '배' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: (stock.niGapRatio ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.niGapRatio != null ? (stock.niGapRatio > 0 ? '+' : '') + stock.niGapRatio + '%' : 'N/A'}
                          </td>
                        </>
                      )}

                      {mode === 'analyst' && (
                        <>
                          <td className="px-3 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {stock.targetPriceWeighted ? formatPrice(stock.targetPriceWeighted, stock.market) : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-black" style={{ color: (stock.upside ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {stock.upside != null ? (stock.upside > 0 ? '+' : '') + stock.upside + '%' : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {stock.rating ? '★' + stock.rating.toFixed(1) : '-'}
                              {stock.analystCount ? ` (${stock.analystCount})` : ''}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="px-3 py-3 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        {formatMoney(stock.marketCap, stock.market)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatPrice(stock.price, stock.market)}</div>
                        <div className="text-[10px] flex items-center justify-end gap-0.5"
                          style={{ color: (stock.changePct ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {(stock.changePct ?? 0) >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {formatPct(stock.changePct)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
          )}

          <div className="text-center text-[10px] py-3" style={{ color: 'var(--text-muted)' }}>
            본 분석은 투자 자문이 아닌 정보 제공 목적이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
          </div>
        </>
      )}
    </div>
  );
}
