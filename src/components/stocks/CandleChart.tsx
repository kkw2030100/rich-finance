'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine, type Time, type UTCTimestamp,
} from 'lightweight-charts';

interface PriceRow {
  date: string;
  open: number; high: number; low: number; close: number; volume: number;
}

interface CandleChartProps {
  code: string;
  isUS?: boolean;  // USD 종목 여부 (가격 포맷)
}

interface AnalystPoint {
  id: string;
  x: number; y: number;
  color: string;
  isUp: boolean;
  provider: string;
  date: string;
  isoDate: string;
  targetPrice: number;
  priceAtAnnouncement: number | null;
  opinion: string;
}

type Timeframe = 'D' | 'W' | 'M';

// "26/04/16" → "2026-04-16"
function parseAnalystDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const parts = d.split('/');
  if (parts.length !== 3) return null;
  const yy = parseInt(parts[0]);
  if (isNaN(yy)) return null;
  const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
  return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

// daily는 오름차순 — targetDate 이전 또는 같은 가장 최근 close
function priceAtDate(daily: PriceRow[], targetDate: string): number | null {
  let result = null;
  for (const r of daily) {
    if (r.date <= targetDate) result = r.close;
    else break;
  }
  return result;
}

// 애널리스트 발표일을 현재 timeframe(D/W/M)의 봉 날짜로 매핑
// bars는 오름차순. isoDate <= bar.date인 첫 봉 찾음 (해당 봉이 isoDate를 포함)
function mapAnalystDateToBar(bars: PriceRow[], isoDate: string): string | null {
  for (const b of bars) {
    if (b.date >= isoDate) return b.date;
  }
  // 모든 봉이 isoDate보다 이전이면 가장 마지막 봉
  return bars.length > 0 ? bars[bars.length - 1].date : null;
}

function aggregateBars(daily: PriceRow[], tf: Timeframe): PriceRow[] {
  if (tf === 'D') return daily;
  const groups = new Map<string, PriceRow[]>();
  for (const r of daily) {
    const d = new Date(r.date);
    let key: string;
    if (tf === 'W') {
      // ISO week
      const tmp = new Date(d);
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7); // Thursday
      const week1 = new Date(tmp.getFullYear(), 0, 4);
      const wn = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      key = `${tmp.getFullYear()}-W${String(wn).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return [...groups.entries()].map(([, bars]) => {
    bars.sort((a, b) => a.date.localeCompare(b.date));
    const first = bars[0], last = bars[bars.length - 1];
    return {
      date: last.date,
      open: first.open,
      high: Math.max(...bars.map(b => b.high)),
      low: Math.min(...bars.map(b => b.low)),
      close: last.close,
      volume: bars.reduce((s, b) => s + (b.volume || 0), 0),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function calcMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < period) { out.push(null); continue; }
    let sum = 0;
    for (let j = i + 1 - period; j <= i; j++) sum += closes[j];
    out.push(sum / period);
  }
  return out;
}

function dateToTime(date: string): UTCTimestamp {
  return Math.floor(new Date(date + 'T00:00:00Z').getTime() / 1000) as UTCTimestamp;
}

const MA_CONFIGS = [
  { period: 5, color: '#22c55e', label: 'MA5' },
  { period: 20, color: '#ef4444', label: 'MA20' },
  { period: 60, color: '#f97316', label: 'MA60' },
  { period: 120, color: '#a855f7', label: 'MA120' },
];

export function CandleChart({ code, isUS = false }: CandleChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs = useRef<ISeriesApi<'Line'>[]>([]);

  const [tf, setTf] = useState<Timeframe>('D');
  const [daily, setDaily] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [consensus, setConsensus] = useState<{
    targetPriceWeighted: number | null;
    targetPriceHigh?: number | null;
    targetPriceLow?: number | null;
    upside: number | null;
    rating: number | null;
    analystCount: number;
    consensusEps: number | null;
    consensusPer: number | null;
    currentPrice: number | null;
    opinionText?: string;
    currency?: string;
    analysts?: Array<{ provider: string; targetPrice: number; weight: number; date: string; opinion?: string }>;
  } | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const analystLinesRef = useRef<IPriceLine[]>([]);
  const targetRangeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [analystPoints, setAnalystPoints] = useState<AnalystPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<AnalystPoint | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // hover 시 표시할 OHLC + MA. null이면 마지막 봉으로 폴백
  const [hoverInfo, setHoverInfo] = useState<{
    date: string;
    open: number; high: number; low: number; close: number; volume: number;
    ma: (number | null)[];
  } | null>(null);
  const [lastBar, setLastBar] = useState<typeof hoverInfo>(null);

  // Fetch 600일 일봉
  useEffect(() => {
    setLoading(true);
    fetch(`/api/stocks/${code}/prices?days=600`)
      .then(r => r.json())
      .then((rows: PriceRow[]) => {
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        setDaily(sorted);
      })
      .finally(() => setLoading(false));
  }, [code]);

  // 컨센서스 (목표가) — 한국 + 미국 모두
  useEffect(() => {
    fetch(`/api/stocks/${code}/consensus`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && !d.error ? setConsensus(d) : setConsensus(null))
      .catch(() => setConsensus(null));
  }, [code]);

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 480,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.15)' },
        horzLines: { color: 'rgba(75, 85, 99, 0.15)' },
      },
      rightPriceScale: { borderColor: 'rgba(75, 85, 99, 0.3)', scaleMargins: { top: 0.05, bottom: 0.25 } },
      timeScale: { borderColor: 'rgba(75, 85, 99, 0.3)', timeVisible: false, secondsVisible: false },
      crosshair: {
        mode: 1,
        vertLine: {
          labelVisible: true,
          labelBackgroundColor: '#3b82f6',
          color: 'rgba(156, 163, 175, 0.5)',
          width: 1,
          style: 3, // dashed
        },
        horzLine: {
          labelVisible: true,
          labelBackgroundColor: '#3b82f6',
          color: 'rgba(156, 163, 175, 0.5)',
          width: 1,
          style: 3,
        },
      },
      localization: {
        // 가격 라벨 한국 종목은 정수, 미국은 소수점 2자리
        priceFormatter: isUS
          ? (p: number) => '$' + p.toFixed(2)
          : (p: number) => Math.round(p).toLocaleString(),
      },
    });
    chartApiRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444', downColor: '#3b82f6',
      wickUpColor: '#ef4444', wickDownColor: '#3b82f6',
      borderVisible: false,
      priceFormat: isUS
        ? { type: 'price', precision: 2, minMove: 0.01 }
        : { type: 'price', precision: 0, minMove: 1 },
    });
    candleRef.current = candle;

    const volume = chart.addSeries(HistogramSeries, {
      color: '#94a3b8',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeRef.current = volume;

    // MA 라인들
    maRefs.current = MA_CONFIGS.map(cfg =>
      chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
    );

    // 보이지 않는 시리즈 — 애널리스트 목표가 포함하게 가격 스케일 확장용
    targetRangeSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // 리사이즈
    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartApiRef.current) {
        chartApiRef.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartApiRef.current = null;
    };
  }, [isUS]);

  // 데이터 업데이트
  useEffect(() => {
    if (!candleRef.current || daily.length === 0) return;
    const bars = aggregateBars(daily, tf);
    if (bars.length === 0) return;

    const candleData = bars.map(b => ({
      time: dateToTime(b.date),
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    candleRef.current.setData(candleData);

    // 거래량 (color: 양봉/음봉)
    const volumeData = bars.map((b, i) => {
      const prev = i > 0 ? bars[i - 1].close : b.open;
      const up = b.close >= prev;
      return {
        time: dateToTime(b.date),
        value: b.volume || 0,
        color: up ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)',
      };
    });
    volumeRef.current?.setData(volumeData);

    // MA
    const closes = bars.map(b => b.close);
    MA_CONFIGS.forEach((cfg, idx) => {
      const ma = calcMA(closes, cfg.period);
      const data = bars.map((b, i) => ({
        time: dateToTime(b.date),
        value: ma[i],
      })).filter(d => d.value !== null) as Array<{ time: Time; value: number }>;
      maRefs.current[idx]?.setData(data);
    });

    // 시간 축 범위 자동 맞춤 (최근 ~120봉)
    const visible = Math.min(bars.length, tf === 'D' ? 120 : tf === 'W' ? 80 : 60);
    chartApiRef.current?.timeScale().setVisibleLogicalRange({
      from: bars.length - visible,
      to: bars.length,
    });

    // 마지막 봉 정보 (default 표시용)
    const lastIdx = bars.length - 1;
    const last = bars[lastIdx];
    if (last) {
      const maVals = MA_CONFIGS.map(cfg => {
        if (lastIdx + 1 < cfg.period) return null;
        let s = 0;
        for (let j = lastIdx + 1 - cfg.period; j <= lastIdx; j++) s += closes[j];
        return s / cfg.period;
      });
      setLastBar({
        date: last.date,
        open: last.open, high: last.high, low: last.low, close: last.close,
        volume: last.volume || 0,
        ma: maVals,
      });
    }
  }, [daily, tf]);

  // crosshair hover — OHLC + MA 값 추적
  useEffect(() => {
    if (!chartApiRef.current || !candleRef.current) return;
    const chart = chartApiRef.current;
    const candle = candleRef.current;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMove = (param: any) => {
      if (!param?.time || !param?.seriesData) {
        setHoverInfo(null);
        return;
      }
      const c = param.seriesData.get(candle);
      if (!c) {
        setHoverInfo(null);
        return;
      }
      const v = volumeRef.current ? param.seriesData.get(volumeRef.current) : null;
      const maVals = MA_CONFIGS.map((_, i) => {
        const m = maRefs.current[i] ? param.seriesData.get(maRefs.current[i]) : null;
        return m?.value ?? null;
      });
      // time → date 변환
      const ts = typeof param.time === 'number' ? param.time : 0;
      const d = new Date(ts * 1000);
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      setHoverInfo({
        date: dateStr,
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: v?.value ?? 0,
        ma: maVals,
      });
    };

    chart.subscribeCrosshairMove(onMove);
    return () => {
      try { chart.unsubscribeCrosshairMove(onMove); } catch { /* removed */ }
    };
  }, [daily, tf]);

  // 컨센서스 목표가 라인 (가중평균 + 개별 애널리스트)
  useEffect(() => {
    if (!candleRef.current || !consensus) return;

    // 기존 라인 제거
    if (targetLineRef.current) {
      candleRef.current.removePriceLine(targetLineRef.current);
      targetLineRef.current = null;
    }
    analystLinesRef.current.forEach(l => candleRef.current?.removePriceLine(l));
    analystLinesRef.current = [];

    // 한국 종목 가중평균 목표가는 헤더 + 개별 점으로 충분 — horizontal line 제거
    // 미국 종목은 개별 점이 없으므로 가중평균 라인을 유지
    if (isUS && consensus.targetPriceWeighted && consensus.targetPriceWeighted > 0) {
      const upsideStr = consensus.upside != null
        ? ` ${consensus.upside >= 0 ? '+' : ''}${consensus.upside.toFixed(0)}%`
        : '';
      targetLineRef.current = candleRef.current.createPriceLine({
        price: consensus.targetPriceWeighted,
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `목표${upsideStr}`,
      });
    }

    // 미국 종목: 목표가 High/Low 범위 라인
    if (isUS && consensus.targetPriceHigh && consensus.targetPriceHigh > 0) {
      const high = candleRef.current.createPriceLine({
        price: consensus.targetPriceHigh,
        color: 'rgba(34, 197, 94, 0.5)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '최고',
      });
      analystLinesRef.current.push(high);
    }
    if (isUS && consensus.targetPriceLow && consensus.targetPriceLow > 0) {
      const low = candleRef.current.createPriceLine({
        price: consensus.targetPriceLow,
        color: 'rgba(239, 68, 68, 0.5)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '최저',
      });
      analystLinesRef.current.push(low);
    }
  }, [consensus, daily, isUS]);

  // 애널리스트 점 좌표 계산 (HTML 오버레이) — 한국 종목만 (미국은 개별 데이터 없음)
  useEffect(() => {
    if (isUS) {
      setAnalystPoints([]);
      targetRangeSeriesRef.current?.setData([]);
      return;
    }
    if (!chartApiRef.current || !candleRef.current || !consensus?.analysts || daily.length === 0) {
      setAnalystPoints([]);
      targetRangeSeriesRef.current?.setData([]);
      return;
    }

    // 1) 현재 timeframe의 봉 데이터 (애널리스트 → 봉 매핑용)
    const bars = aggregateBars(daily, tf);
    if (bars.length === 0) {
      setAnalystPoints([]);
      targetRangeSeriesRef.current?.setData([]);
      return;
    }

    // 2) 애널리스트 → 봉 시간 매핑
    const validAnalysts = consensus.analysts
      .map(a => {
        const isoDate = parseAnalystDate(a.date);
        if (!isoDate || !a.targetPrice || a.targetPrice <= 0) return null;
        const barDate = mapAnalystDateToBar(bars, isoDate);
        if (!barDate) return null;
        return { ...a, isoDate, barDate };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // 3) 가격 스케일 확장용 invisible series — 봉 시간 기준
    if (targetRangeSeriesRef.current) {
      // 같은 봉에 여러 애널리스트가 매핑되면 max 사용
      const dataMap = new Map<number, number>();
      for (const a of validAnalysts) {
        const t = dateToTime(a.barDate);
        const existing = dataMap.get(t);
        if (!existing || a.targetPrice > existing) dataMap.set(t, a.targetPrice);
      }
      // min/max 가격을 첫/마지막 봉에 추가 → 가격 범위 강제 확장
      if (validAnalysts.length > 0) {
        const minTarget = Math.min(...validAnalysts.map(a => a.targetPrice));
        const maxTarget = Math.max(...validAnalysts.map(a => a.targetPrice));
        const firstT = dateToTime(bars[0].date);
        const lastT = dateToTime(bars[bars.length - 1].date);
        if (!dataMap.has(firstT)) dataMap.set(firstT, minTarget);
        if (!dataMap.has(lastT)) dataMap.set(lastT, maxTarget);
      }
      const seriesData = [...dataMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, v]) => ({ time: t as UTCTimestamp, value: v }));
      targetRangeSeriesRef.current.setData(seriesData);
    }

    // 4) 점 좌표 계산
    const computePoints = () => {
      const ts = chartApiRef.current?.timeScale();
      const series = candleRef.current;
      if (!ts || !series) return;

      const pts: AnalystPoint[] = [];
      for (const a of validAnalysts) {
        const time = dateToTime(a.barDate);
        const x = ts.timeToCoordinate(time);
        const y = series.priceToCoordinate(a.targetPrice);
        if (x === null || y === null) continue;
        const yNum = Number(y);
        if (yNum < 0 || yNum > 480) continue;

        const announcementPrice = priceAtDate(daily, a.isoDate);
        const isUp = announcementPrice != null && a.targetPrice > announcementPrice;

        pts.push({
          id: `${a.provider}-${a.date}-${a.targetPrice}`,
          x: Number(x),
          y: yNum,
          color: isUp ? '#22c55e' : '#ef4444',
          isUp,
          provider: a.provider,
          date: a.date,
          isoDate: a.isoDate,
          targetPrice: a.targetPrice,
          priceAtAnnouncement: announcementPrice,
          opinion: a.opinion || '',
        });
      }
      setAnalystPoints(pts);
    };

    // 약간 지연 후 첫 계산 (가격 스케일 갱신 대기)
    const t = setTimeout(computePoints, 50);
    const ts = chartApiRef.current.timeScale();
    ts.subscribeVisibleLogicalRangeChange(computePoints);
    return () => {
      clearTimeout(t);
      try { ts.unsubscribeVisibleLogicalRangeChange(computePoints); } catch { /* chart removed */ }
    };
  }, [consensus, daily, tf, isUS]);

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* 컨센서스 요약 — 한국 + 미국 */}
      {consensus && consensus.targetPriceWeighted && consensus.targetPriceWeighted > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4 text-[11px] flex-wrap">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>목표가 </span>
              <span className="font-bold" style={{ color: 'var(--accent-green)' }}>
                {isUS ? '$' + consensus.targetPriceWeighted.toFixed(2) : consensus.targetPriceWeighted.toLocaleString() + '원'}
              </span>
              {consensus.upside != null && (
                <span className="ml-1" style={{ color: consensus.upside >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  ({consensus.upside >= 0 ? '+' : ''}{consensus.upside.toFixed(0)}%)
                </span>
              )}
            </div>
            {/* 미국: 목표가 범위 (Low ~ High) */}
            {isUS && consensus.targetPriceLow && consensus.targetPriceHigh && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>범위 </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  ${consensus.targetPriceLow.toFixed(2)} ~ ${consensus.targetPriceHigh.toFixed(2)}
                </span>
              </div>
            )}
            {consensus.rating != null && consensus.rating > 0 && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{isUS ? '평가 ' : '★ '}</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{consensus.rating.toFixed(2)}</span>
                {consensus.opinionText && <span className="ml-1" style={{ color: 'var(--accent-yellow)' }}>{consensus.opinionText}</span>}
                {!consensus.opinionText && <span style={{ color: 'var(--text-muted)' }}> ({consensus.analystCount}개)</span>}
              </div>
            )}
            {consensus.consensusEps != null && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>EPS </span>
                <span style={{ color: 'var(--text-primary)' }}>{consensus.consensusEps.toLocaleString()}원</span>
              </div>
            )}
            {consensus.consensusPer != null && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>PER </span>
                <span style={{ color: 'var(--text-primary)' }}>{consensus.consensusPer.toFixed(1)}배</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OHLC + MA 정보 행 (hover 우선, 없으면 마지막 봉) */}
      {(() => {
        const info = hoverInfo || lastBar;
        if (!info) return null;
        const fmtPrice = (v: number | null | undefined) =>
          v == null ? '-' : isUS ? '$' + v.toFixed(2) : v.toLocaleString();
        const fmtVol = (v: number) =>
          v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v >= 1_000 ? (v / 1_000).toFixed(0) + 'K' : v.toString();
        const isUp = info.close >= info.open;
        const closeColor = isUp ? 'var(--accent-red)' : 'var(--accent-blue)';
        const change = info.open > 0 ? ((info.close - info.open) / info.open * 100) : 0;
        return (
          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 mb-2 text-[11px]">
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span style={{ color: 'var(--text-muted)' }}>{info.date}</span>
              <span><span style={{ color: 'var(--text-muted)' }}>시 </span><span style={{ color: 'var(--text-primary)' }}>{fmtPrice(info.open)}</span></span>
              <span><span style={{ color: 'var(--text-muted)' }}>고 </span><span style={{ color: 'var(--accent-red)' }}>{fmtPrice(info.high)}</span></span>
              <span><span style={{ color: 'var(--text-muted)' }}>저 </span><span style={{ color: 'var(--accent-blue)' }}>{fmtPrice(info.low)}</span></span>
              <span><span style={{ color: 'var(--text-muted)' }}>종 </span><span className="font-bold" style={{ color: closeColor }}>{fmtPrice(info.close)}</span>
                <span className="ml-1" style={{ color: closeColor }}>({change >= 0 ? '+' : ''}{change.toFixed(2)}%)</span>
              </span>
              <span><span style={{ color: 'var(--text-muted)' }}>거래량 </span><span style={{ color: 'var(--text-secondary)' }}>{fmtVol(info.volume)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              {(['D', 'W', 'M'] as Timeframe[]).map(t => (
                <button key={t} onClick={() => setTf(t)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                  style={{
                    background: tf === t ? 'rgba(59,130,246,0.18)' : 'transparent',
                    color: tf === t ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}>
                  {t === 'D' ? '일봉' : t === 'W' ? '주봉' : '월봉'}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* MA 값 행 */}
      {(() => {
        const info = hoverInfo || lastBar;
        if (!info) return null;
        const fmtPrice = (v: number | null | undefined) =>
          v == null ? '-' : isUS ? '$' + v.toFixed(2) : Math.round(v).toLocaleString();
        return (
          <div className="flex items-center gap-x-3 gap-y-1 mb-3 text-[11px] flex-wrap">
            {MA_CONFIGS.map((cfg, i) => (
              <span key={cfg.label} className="flex items-center gap-1">
                <span className="w-3 h-0.5 inline-block" style={{ background: cfg.color }} />
                <span style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
                <span style={{ color: cfg.color, fontWeight: 600 }}>{fmtPrice(info.ma[i])}</span>
              </span>
            ))}
          </div>
        );
      })()}

      {loading && <div className="h-[480px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>차트 로딩 중...</div>}

      {/* 차트 + 오버레이 wrapper */}
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: loading ? 0 : 480 }}
        onClick={() => setSelectedPoint(null)}>
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />

        {/* 애널리스트 목표가 점 — z-index 명시 + hit area 확장 */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
          {analystPoints.map(p => (
            <div key={p.id}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); setSelectedPoint(p); }}
              style={{
                position: 'absolute',
                // 24x24 hit area (실제 점은 가운데 12x12)
                left: p.x - 12,
                top: p.y - 12,
                width: 24, height: 24,
                cursor: 'pointer',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`${p.provider} ${p.date} ${p.targetPrice.toLocaleString()}원`}>
              <div style={{
                width: selectedPoint?.id === p.id ? 14 : 12,
                height: selectedPoint?.id === p.id ? 14 : 12,
                borderRadius: '50%',
                background: p.color,
                border: '2px solid rgba(255,255,255,0.3)',
                boxShadow: selectedPoint?.id === p.id ? `0 0 0 3px ${p.color}80` : 'none',
                transition: 'all 0.15s',
              }} />
            </div>
          ))}
        </div>

        {/* 클릭된 점 툴팁 */}
        {selectedPoint && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: Math.min(selectedPoint.x + 14, (wrapperRef.current?.clientWidth || 800) - 230),
              top: Math.max(selectedPoint.y - 60, 8),
              width: 220,
              background: 'var(--bg-card)',
              border: `1px solid ${selectedPoint.color}80`,
              borderRadius: 8,
              padding: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              zIndex: 10,
              pointerEvents: 'auto',
            }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selectedPoint.provider}</span>
              <button onClick={() => setSelectedPoint(null)}
                className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>발표일</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedPoint.isoDate}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>목표가</span>
                <span className="font-bold" style={{ color: selectedPoint.color }}>{selectedPoint.targetPrice.toLocaleString()}원</span>
              </div>
              {selectedPoint.priceAtAnnouncement != null && (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>당시 주가</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{selectedPoint.priceAtAnnouncement.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>당시 상승여력</span>
                    <span style={{ color: selectedPoint.color }}>
                      {((selectedPoint.targetPrice - selectedPoint.priceAtAnnouncement) / selectedPoint.priceAtAnnouncement * 100).toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
              {selectedPoint.opinion && (
                <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>의견</span>
                  <span className="font-semibold" style={{ color: 'var(--accent-yellow)' }}>{selectedPoint.opinion}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
