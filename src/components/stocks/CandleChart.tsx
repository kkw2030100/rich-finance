'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries,
  type IChartApi, type ISeriesApi, type Time, type UTCTimestamp,
} from 'lightweight-charts';

interface PriceRow {
  date: string;
  open: number; high: number; low: number; close: number; volume: number;
}

interface CandleChartProps {
  code: string;
  isUS?: boolean;  // USD 종목 여부 (가격 포맷)
}

type Timeframe = 'D' | 'W' | 'M';

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

  // Fetch 600일 일봉
  useEffect(() => {
    setLoading(true);
    fetch(`/api/stocks/${code}/prices?days=600`)
      .then(r => r.json())
      .then((rows: PriceRow[]) => {
        // [최신, ...] → [오래된, ..., 최신]
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        setDaily(sorted);
      })
      .finally(() => setLoading(false));
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
      crosshair: { mode: 1 },
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
  }, [daily, tf]);

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* 헤더 — 일/주/월 토글 + MA 범례 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[11px]">
          {MA_CONFIGS.map(cfg => (
            <div key={cfg.label} className="flex items-center gap-1">
              <div className="w-3 h-0.5" style={{ background: cfg.color }} />
              <span style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['D', 'W', 'M'] as Timeframe[]).map(t => (
            <button key={t} onClick={() => setTf(t)}
              className="px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors"
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

      {loading && <div className="h-[480px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>차트 로딩 중...</div>}
      <div ref={chartRef} style={{ width: '100%', height: loading ? 0 : 480 }} />
    </div>
  );
}
