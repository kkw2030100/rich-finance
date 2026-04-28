'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X, Star } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  ReferenceLine, ReferenceArea, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchScores, ScoreItem, formatMoney, deriveTier, isPreferredStock } from '@/lib/api';
import { cachedFetch } from '@/lib/swrCache';
import { useFavorites } from '@/lib/useFavorites';
import { useHoldings } from '@/lib/useHoldings';

type MarketKey = 'all' | 'kospi' | 'kosdaq' | 'us';
type TierKey = 'all' | '초대형주' | '대형주' | '중형주' | '소형주' | '미국주식';
type ProfitKey = 'all' | 'profit' | 'p10' | 'p50' | 'p100';

const MARKETS: { key: MarketKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'kospi', label: 'KOSPI' },
  { key: 'kosdaq', label: 'KOSDAQ' },
  { key: 'us', label: 'US' },
];

const TIERS: { key: TierKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '초대형주', label: '초대형 5조+' },
  { key: '대형주', label: '대형 1~5조' },
  { key: '중형주', label: '중형 3천억~1조' },
  { key: '소형주', label: '소형 ~3천억' },
];

const PROFITS: { key: ProfitKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'profit', label: '흑자만' },
  { key: 'p10', label: '10억+' },
  { key: 'p50', label: '50억+' },
  { key: 'p100', label: '100억+' },
];

interface Point {
  code: string;
  name: string;
  market: string;
  x: number;            // niGrowth %
  y: number;            // mcapGrowth %
  z: number;            // sqrt(marketCap) — bubble size
  marketCap: number;
  niChange: number | null;
  ttmNi: number;
  score: number;
  verdict: string;
  isHolding: boolean;
  isFavorite: boolean;
  isMatch: boolean;     // 검색 매치
}

const COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
  gold: '#fbbf24',
  goldStroke: '#f59e0b',
  match: '#a855f7',
};

function quadrant(x: number, y: number): 'gold' | 'risk' | 'fair_up' | 'fair_down' {
  if (x >= 0 && y < 0) return 'gold';        // 순이익↑ + 시총↓ — 저평가 발굴
  if (x < 0 && y >= 0) return 'risk';        // 순이익↓ + 시총↑ — 추격 위험
  if (x >= 0 && y >= 0) return 'fair_up';    // 정당한 상승
  return 'fair_down';                         // 정당한 하락
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const idx = Math.max(0, Math.min(values.length - 1, Math.floor(values.length * p)));
  return values[idx];
}

export function MapLive() {
  const [allData, setAllData] = useState<ScoreItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const router = useRouter();
  const [market, setMarket] = useState<MarketKey>('kospi');
  const [tier, setTier] = useState<TierKey>('all');
  const [profit, setProfit] = useState<ProfitKey>('all');
  const [search, setSearch] = useState('');
  const [excludePreferred, setExcludePreferred] = useState(true);

  const { isFavorite, favorites } = useFavorites();
  const { holdings } = useHoldings();
  const holdingTickers = useMemo(() => new Set(holdings.map(h => h.ticker)), [holdings]);

  // 데이터 prefetch (KR + US)
  useEffect(() => {
    const krC = cachedFetch<ScoreItem[]>('scores:kr', () => fetchScores({ limit: 3000 }).then(r => r.data || []).catch(() => []));
    const usC = cachedFetch<ScoreItem[]>('scores:us', () => fetchScores({ market: 'us', limit: 5000 }).then(r => r.data || []).catch(() => []));

    if (krC.cached || usC.cached) {
      setAllData([...(krC.cached || []), ...(usC.cached || [])]);
      setLoaded(true);
    }
    Promise.all([krC.promise, usC.promise]).then(([kr, us]) => {
      setAllData([...kr, ...us]);
      setLoaded(true);
    });
  }, []);

  // 필터링 + Point 변환
  const points: Point[] = useMemo(() => {
    const q = search.trim().toLowerCase();

    // niGrowth 폴백: API의 niGrowth가 null이면 (niChange / |prevNi|) * 100로 계산
    // prevNi = ttmNetIncome - niChange (TTM 기준 1년전 ≒ 현재 - 증감)
    const computeNiGrowth = (d: ScoreItem): number | null => {
      if (d.niGrowth != null && Number.isFinite(d.niGrowth)) return d.niGrowth;
      const ni = d.ttmNetIncome ?? 0;
      const ch = d.niChange;
      if (ch == null) return null;
      const prev = ni - ch;
      if (Math.abs(prev) < 1) return null; // 1억 미만 prev는 폭발적 증감율 노이즈 → 제외
      return (ch / Math.abs(prev)) * 100;
    };

    return allData
      .map(d => ({ ...d, _xv: computeNiGrowth(d) }))
      .filter(d => {
        if (d._xv == null || d.mcapGrowth == null) return false;
        if (!Number.isFinite(d._xv) || !Number.isFinite(d.mcapGrowth)) return false;
        if (excludePreferred && isPreferredStock(d.code, d.market)) return false;

        // 시장 필터
        if (market !== 'all') {
          const m = (d.market || '').toLowerCase();
          if (market === 'us' && m !== 'us') return false;
          if (market === 'kospi' && m !== 'kospi') return false;
          if (market === 'kosdaq' && m !== 'kosdaq') return false;
        }

        // 시총 tier 필터
        if (tier !== 'all') {
          const t = deriveTier(d.marketCap, d.market);
          if (t !== tier) return false;
        }

        // 당기순이익 필터 (TTM 기준, 억 단위)
        if (profit !== 'all') {
          const ni = d.ttmNetIncome ?? 0;
          if (profit === 'profit' && ni <= 0) return false;
          if (profit === 'p10' && ni < 10) return false;
          if (profit === 'p50' && ni < 50) return false;
          if (profit === 'p100' && ni < 100) return false;
        }
        return true;
      })
      .map(d => {
        const isMatch = q.length > 0 && (
          d.code.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q)
        );
        return {
          code: d.code,
          name: d.name,
          market: d.market,
          x: d._xv!,
          y: d.mcapGrowth!,
          z: Math.sqrt(Math.max(1, d.marketCap || 1)),
          marketCap: d.marketCap,
          niChange: d.niChange,
          ttmNi: d.ttmNetIncome,
          score: d.score,
          verdict: d.verdict,
          isHolding: holdingTickers.has(d.code),
          isFavorite: isFavorite(d.code),
          isMatch,
        };
      });
  }, [allData, market, tier, profit, search, excludePreferred, holdingTickers, favorites, isFavorite]);

  // 도메인 (이상치 제거 — 5%/95% percentile)
  // 양/음 양쪽이 의미 있어야 하므로 0이 중앙 근처에 오도록 보정
  const domain = useMemo(() => {
    if (points.length < 10) return { x: [-100, 100] as [number, number], y: [-100, 100] as [number, number] };
    const xs = points.map(p => p.x).sort((a, b) => a - b);
    const ys = points.map(p => p.y).sort((a, b) => a - b);
    let xLo = Math.min(-10, percentile(xs, 0.05));
    let xHi = Math.max(10, percentile(xs, 0.95));
    let yLo = Math.min(-10, percentile(ys, 0.05));
    let yHi = Math.max(10, percentile(ys, 0.95));
    // 한쪽이 너무 좁아지면 최소 30% 확보 — 0선이 보여야 분면 의미가 있음
    if (xHi - 0 < (0 - xLo) * 0.4) xHi = (0 - xLo) * 0.6;
    if (0 - xLo < (xHi - 0) * 0.4) xLo = -(xHi - 0) * 0.6;
    if (yHi - 0 < (0 - yLo) * 0.4) yHi = (0 - yLo) * 0.6;
    if (0 - yLo < (yHi - 0) * 0.4) yLo = -(yHi - 0) * 0.6;
    const xPad = (xHi - xLo) * 0.04;
    const yPad = (yHi - yLo) * 0.04;
    return {
      x: [xLo - xPad, xHi + xPad] as [number, number],
      y: [yLo - yPad, yHi + yPad] as [number, number],
    };
  }, [points]);

  // 분면별 통계
  const quadStats = useMemo(() => {
    const stats = {
      gold: { count: 0, sumScore: 0, top: null as Point | null },
      risk: { count: 0, sumScore: 0, top: null as Point | null },
      fair_up: { count: 0, sumScore: 0, top: null as Point | null },
      fair_down: { count: 0, sumScore: 0, top: null as Point | null },
    };
    for (const p of points) {
      const q = quadrant(p.x, p.y);
      stats[q].count++;
      stats[q].sumScore += p.score;
      if (!stats[q].top || (p.score ?? 0) > (stats[q].top!.score ?? 0)) stats[q].top = p;
    }
    return stats;
  }, [points]);

  // 데이터 분리 (z-order 제어 — 일반 → 검색매치 → 관심 → 보유 순)
  const layered = useMemo(() => {
    const base: Point[] = [];
    const matches: Point[] = [];
    const favs: Point[] = [];
    const holds: Point[] = [];
    for (const p of points) {
      if (p.isHolding) holds.push(p);
      else if (p.isFavorite) favs.push(p);
      else if (p.isMatch) matches.push(p);
      else base.push(p);
    }
    return { base, matches, favs, holds };
  }, [points]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">데이터 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 필터 바 */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <FilterRow label="시장" options={MARKETS} value={market} onChange={setMarket} />
        <FilterRow label="시가총액" options={TIERS} value={tier} onChange={setTier} />
        <FilterRow label="당기순이익" options={PROFITS} value={profit} onChange={setProfit} />
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={excludePreferred} onChange={e => setExcludePreferred(e.target.checked)} />
            우선주 제외
          </label>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{points.length.toLocaleString()}</span> / {allData.length.toLocaleString()} 종목
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="종목명 또는 코드로 강조 표시"
          className="w-full pl-9 pr-8 py-2 rounded-lg text-xs"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* 분면 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <QuadCard
          label="저평가 발굴"
          tag="순이익↑ 시총↓"
          highlight
          color={COLORS.positive}
          stats={quadStats.gold}
        />
        <QuadCard
          label="추격 위험"
          tag="순이익↓ 시총↑"
          color={COLORS.negative}
          stats={quadStats.risk}
        />
        <QuadCard
          label="정당한 상승"
          tag="순이익↑ 시총↑"
          color={COLORS.neutral}
          stats={quadStats.fair_up}
        />
        <QuadCard
          label="정당한 하락"
          tag="순이익↓ 시총↓"
          color={COLORS.neutral}
          stats={quadStats.fair_down}
        />
      </div>

      {/* 차트 */}
      <div className="rounded-xl p-3 relative" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ width: '100%', height: 'min(70vh, 640px)', minHeight: 380 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 36, left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />

              {/* 분면 강조 영역 */}
              <ReferenceArea
                x1={0} x2={domain.x[1]} y1={domain.y[0]} y2={0}
                fill={COLORS.positive} fillOpacity={0.13} stroke="none"
                ifOverflow="visible"
              />
              <ReferenceArea
                x1={domain.x[0]} x2={0} y1={0} y2={domain.y[1]}
                fill={COLORS.negative} fillOpacity={0.09} stroke="none"
                ifOverflow="visible"
              />

              <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 4" />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 4" />

              <XAxis
                type="number" dataKey="x" domain={domain.x} allowDataOverflow
                tickFormatter={v => `${v >= 0 ? '+' : ''}${Math.round(v)}%`}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="rgba(255,255,255,0.15)"
                label={{ value: '순이익 증감율 (%)', position: 'insideBottom', offset: -22, fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                type="number" dataKey="y" domain={domain.y} allowDataOverflow
                tickFormatter={v => `${v >= 0 ? '+' : ''}${Math.round(v)}%`}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                stroke="rgba(255,255,255,0.15)"
                label={{ value: '시총 증감율 (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[24, 600]} />

              <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '2 4' }} content={<MapTooltip />} />

              {/* 일반 점 */}
              <Scatter data={layered.base} shape={renderDot} isAnimationActive={false}
                onClick={(d) => {
                  const code = (d as { payload?: Point })?.payload?.code;
                  if (code) router.push(`/stocks/${code}`);
                }} />
              {/* 검색 매치 (보라 강조) */}
              <Scatter data={layered.matches} shape={renderMatch} isAnimationActive={false}
                onClick={(d) => {
                  const code = (d as { payload?: Point })?.payload?.code;
                  if (code) router.push(`/stocks/${code}`);
                }} />
              {/* 관심종목 (외곽 별) */}
              <Scatter data={layered.favs} shape={renderFavStar} isAnimationActive={false}
                onClick={(d) => {
                  const code = (d as { payload?: Point })?.payload?.code;
                  if (code) router.push(`/stocks/${code}`);
                }} />
              {/* 보유종목 (채운 별) */}
              <Scatter data={layered.holds} shape={renderHoldStar} isAnimationActive={false}
                onClick={(d) => {
                  const code = (d as { payload?: Point })?.payload?.code;
                  if (code) router.push(`/stocks/${code}`);
                }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* 분면 라벨 (절대 위치 오버레이) */}
        <div className="absolute top-5 right-7 text-[10px] font-semibold pointer-events-none" style={{ color: COLORS.negative, opacity: 0.7 }}>
          ⚠ 추격 위험
        </div>
        <div className="absolute bottom-12 right-7 text-[10px] font-semibold pointer-events-none" style={{ color: COLORS.positive, opacity: 0.9 }}>
          ★ 저평가 발굴
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 flex-wrap text-[11px] mt-2 pt-2" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.positive }} /> 흑자</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.negative }} /> 적자/감소</span>
          <span className="flex items-center gap-1"><Star size={11} fill={COLORS.gold} stroke={COLORS.goldStroke} /> 보유</span>
          <span className="flex items-center gap-1"><Star size={11} fill="none" stroke={COLORS.gold} /> 관심</span>
          <span className="ml-auto">크기 = 시가총액 · X={'>'}0 = 순이익 성장 · Y{'<'}0 = 시총 미반영</span>
        </div>
      </div>
    </div>
  );
}

// ───── 컴포넌트들 ─────

function FilterRow<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map(o => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              className="px-2.5 py-1 text-[11px] rounded-md cursor-pointer transition-colors"
              style={{
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? '#6ea8fe' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                fontWeight: active ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuadCard({
  label, tag, highlight, color, stats,
}: {
  label: string;
  tag: string;
  highlight?: boolean;
  color: string;
  stats: { count: number; sumScore: number; top: Point | null };
}) {
  const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: highlight ? 'rgba(34,197,94,0.06)' : 'var(--bg-card)',
        border: `1px solid ${highlight ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold" style={{ color: highlight ? color : 'var(--text-primary)' }}>
          {highlight && '★ '}{label}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tag}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {stats.count.toLocaleString()}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>종목 · 평균 {avg.toFixed(1)}점</span>
      </div>
      {stats.top && (
        <Link
          href={`/stocks/${stats.top.code}`}
          className="block text-[11px] mt-1.5 truncate hover:underline"
          style={{ color: 'var(--text-secondary)' }}
          title={`${stats.top.name} ${stats.top.code}`}
        >
          최고: {stats.top.name} <span style={{ color: 'var(--text-muted)' }}>· {stats.top.score.toFixed(1)}</span>
        </Link>
      )}
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: Point;
  // Recharts에서 ZAxis로부터 들어오는 사이즈
  // (raw r 또는 size 둘 중 하나)
  r?: number;
  size?: number;
}

function dotRadius(props: DotProps): number {
  const s = props.size ?? props.r ?? 24;
  return Math.max(3, Math.sqrt(s / Math.PI));
}

function dotColor(p: Point | undefined): string {
  if (!p) return COLORS.neutral;
  if (p.niChange == null) return COLORS.neutral;
  if (p.niChange > 0) return COLORS.positive;
  if (p.niChange < 0) return COLORS.negative;
  return COLORS.neutral;
}

function renderDot(props: DotProps) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <g />;
  const r = dotRadius(props);
  const fill = dotColor(payload);
  return <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.45} stroke="none" />;
}

function renderMatch(props: DotProps) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <g />;
  const r = Math.max(5, dotRadius(props));
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 4} fill={COLORS.match} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={r} fill={COLORS.match} fillOpacity={0.85} stroke="#fff" strokeWidth={1.2} />
    </g>
  );
}

// 채워진 별 (보유)
function renderHoldStar(props: DotProps) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  const size = Math.max(10, dotRadius(props) * 1.3);
  return (
    <path
      d={starPath(cx, cy, size, size * 0.42)}
      fill={COLORS.gold}
      stroke={COLORS.goldStroke}
      strokeWidth={1.4}
    />
  );
}

// 외곽선 별 (관심)
function renderFavStar(props: DotProps) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  const size = Math.max(9, dotRadius(props) * 1.15);
  return (
    <path
      d={starPath(cx, cy, size, size * 0.42)}
      fill="none"
      stroke={COLORS.gold}
      strokeWidth={1.6}
    />
  );
}

// 5각 별 SVG path
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ') + 'Z';
}

function MapTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  if (!p) return null;
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  return (
    <div
      className="rounded-lg p-2.5 text-xs"
      style={{
        background: 'rgba(20,20,28,0.95)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        minWidth: 180,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {p.isHolding && <Star size={12} fill={COLORS.gold} stroke={COLORS.goldStroke} />}
        {!p.isHolding && p.isFavorite && <Star size={12} fill="none" stroke={COLORS.gold} />}
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.code}</span>
      </div>
      <div className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex justify-between gap-4">
          <span>순이익 증감율</span>
          <span style={{ color: p.x >= 0 ? COLORS.positive : COLORS.negative, fontWeight: 600 }}>{fmtPct(p.x)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>시총 증감율</span>
          <span style={{ color: p.y >= 0 ? COLORS.positive : COLORS.negative, fontWeight: 600 }}>{fmtPct(p.y)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>시가총액</span>
          <span style={{ color: 'var(--text-primary)' }}>{formatMoney(p.marketCap, p.market)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>점수</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.score?.toFixed(1) ?? '-'}</span>
        </div>
      </div>
      <div className="mt-1.5 pt-1.5 text-[10px] text-center" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        클릭하여 상세 보기
      </div>
    </div>
  );
}
