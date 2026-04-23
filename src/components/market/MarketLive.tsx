'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Loader2, Zap, BarChart3, RefreshCw } from 'lucide-react';

interface MarketData {
  date: string;
  marketTemp: { score: number; max: number; label: string };
  marketBreadth: { score: number; max: number; label: string };
  seasonality: { score: number; max: number; label: string };
  upDown: { up: number; down: number; flat: number; upLimit: number; downLimit: number; total: number };
  indices: { kospiChange: number; kosdaqChange: number };
  signals: { volumeSpikes: number; turnarounds: number };
}

function GaugeBar({ score, max, label, color }: { score: number; max: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full score-bar" style={{ width: `${(score / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function getTempColor(score: number) {
  if (score <= 1) return 'var(--accent-red)';
  if (score <= 2) return '#f97316';
  if (score <= 3) return 'var(--accent-yellow)';
  if (score <= 4) return 'var(--accent-green)';
  return '#ef4444'; // 과열
}

export function MarketLive() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/overview')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>시장 데이터 불러오는 중...</span>
      </div>
    );
  }

  if (!data) return null;

  const upPct = Math.round((data.upDown.up / data.upDown.total) * 100);
  const downPct = Math.round((data.upDown.down / data.upDown.total) * 100);

  return (
    <div className="space-y-4">
      {/* Market Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <GaugeBar score={data.marketTemp.score} max={data.marketTemp.max}
            label={`시장 온도 — ${data.marketTemp.label}`}
            color={getTempColor(data.marketTemp.score)} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <GaugeBar score={data.marketBreadth.score} max={data.marketBreadth.max}
            label={`시장 폭 — ${data.marketBreadth.label}`}
            color={data.marketBreadth.score >= 4 ? 'var(--accent-green)' : data.marketBreadth.score >= 3 ? 'var(--accent-yellow)' : 'var(--accent-red)'} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <GaugeBar score={data.seasonality.score} max={data.seasonality.max}
            label={`계절성 — ${data.seasonality.label}`}
            color={data.seasonality.score >= 6 ? 'var(--accent-green)' : data.seasonality.score >= 4 ? 'var(--accent-yellow)' : 'var(--accent-red)'} />
        </div>
      </div>

      {/* Up/Down Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            등락 현황 <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{data.date}</span>
          </h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="h-4 rounded-full flex overflow-hidden" style={{ background: 'var(--border)' }}>
                <div style={{ width: `${upPct}%`, background: 'var(--accent-green)' }} />
                <div style={{ width: `${100 - upPct - downPct}%`, background: 'var(--text-muted)', opacity: 0.3 }} />
                <div style={{ width: `${downPct}%`, background: 'var(--accent-red)' }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-black" style={{ color: 'var(--accent-green)' }}>{data.upDown.up}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>상승 ({upPct}%)</div>
            </div>
            <div>
              <div className="text-lg font-black" style={{ color: 'var(--text-muted)' }}>{data.upDown.flat}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>보합</div>
            </div>
            <div>
              <div className="text-lg font-black" style={{ color: 'var(--accent-red)' }}>{data.upDown.down}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>하락 ({downPct}%)</div>
            </div>
          </div>
          {(data.upDown.upLimit > 0 || data.upDown.downLimit > 0) && (
            <div className="flex gap-4 mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
              {data.upDown.upLimit > 0 && <span style={{ color: 'var(--accent-green)' }}>상한가 {data.upDown.upLimit}개</span>}
              {data.upDown.downLimit > 0 && <span style={{ color: 'var(--accent-red)' }}>하한가 {data.upDown.downLimit}개</span>}
            </div>
          )}
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>주요 지표</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>KOSPI 평균 등락</span>
              <span className="flex items-center gap-1 text-sm font-bold"
                style={{ color: data.indices.kospiChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {data.indices.kospiChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {data.indices.kospiChange >= 0 ? '+' : ''}{data.indices.kospiChange}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>KOSDAQ 평균 등락</span>
              <span className="flex items-center gap-1 text-sm font-bold"
                style={{ color: data.indices.kosdaqChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {data.indices.kosdaqChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {data.indices.kosdaqChange >= 0 ? '+' : ''}{data.indices.kosdaqChange}%
              </span>
            </div>
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Zap size={14} style={{ color: 'var(--accent-yellow)' }} />
                거래량 급증 종목
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--accent-yellow)' }}>{data.signals.volumeSpikes}개</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <RefreshCw size={14} style={{ color: 'var(--accent-green)' }} />
                흑자전환 종목
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>{data.signals.turnarounds}개</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center text-[10px] py-2" style={{ color: 'var(--text-muted)' }}>
        본 분석은 투자 자문이 아닌 정보 제공 목적이며, 투자 판단의 책임은 이용자 본인에게 있습니다.
      </div>
    </div>
  );
}
