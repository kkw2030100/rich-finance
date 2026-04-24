'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, Zap, RefreshCw, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

type Country = 'kr' | 'us';
type Period = '3m' | '6m' | '1y' | '3y';

interface MarketData {
  date: string;
  marketTemp: { score: number; max: number; label: string };
  marketBreadth: { score: number; max: number; label: string };
  seasonality: { score: number; max: number; label: string };
  upDown: { up: number; down: number; flat: number; upLimit: number; downLimit: number; total: number };
  indices: { kospiChange: number; kosdaqChange: number };
  signals: { volumeSpikes: number; turnarounds: number };
}

interface RiskPoint { date: string; risk: number; avgChange: number; upRatio: number }
interface RiskSignal { date: string; type: 'buy' | 'sell'; risk: number; reason: string; cashRecommend: number }
interface CurrentRisk { risk: number; date: string; cashRecommend: number; guide: string }

function getRiskColor(risk: number): string {
  if (risk <= 30) return '#22c55e';
  if (risk <= 50) return '#f59e0b';
  if (risk <= 70) return '#f97316';
  return '#ef4444';
}

function getRiskBg(risk: number): string {
  if (risk <= 30) return 'rgba(34,197,94,0.08)';
  if (risk <= 50) return 'rgba(245,158,11,0.08)';
  if (risk <= 70) return 'rgba(249,115,22,0.08)';
  return 'rgba(239,68,68,0.08)';
}

function getRiskLabel(risk: number): string {
  if (risk <= 30) return '안전';
  if (risk <= 50) return '주의';
  if (risk <= 70) return '경계';
  return '위험';
}

function RiskBar({ label, risk, max }: { label: string; risk: number; max: number }) {
  const color = getRiskColor(risk);
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-sm font-black" style={{ color }}>{risk}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/{max}</span></span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(risk / max) * 100}%`, background: color }} />
      </div>
      <div className="flex justify-between mt-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <span>안전</span>
        <span style={{ color }}>{getRiskLabel(risk)}</span>
        <span>위험</span>
      </div>
    </div>
  );
}

const KR_INDICES = [
  { key: 'kospi', label: '코스피' },
  { key: 'kosdaq', label: '코스닥' },
] as const;

const US_INDICES = [
  { key: 'sp500', label: 'S&P 500' },
  { key: 'nasdaq', label: '나스닥' },
  { key: 'dow', label: '다우존스' },
] as const;

export function MarketLive() {
  const [country, setCountry] = useState<Country>('kr');
  const [market, setMarket] = useState('kospi');
  const [period, setPeriod] = useState<Period>('1y');
  const [overview, setOverview] = useState<MarketData | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskPoint[]>([]);
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [current, setCurrent] = useState<CurrentRisk | null>(null);
  const [allRisks, setAllRisks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const indices = country === 'kr' ? KR_INDICES : US_INDICES;
  const marketLabel = indices.find(i => i.key === market)?.label || market;

  // 국가 변경 시 첫 지수로 리셋
  useEffect(() => {
    const first = country === 'kr' ? 'kospi' : 'sp500';
    setMarket(first);
  }, [country]);

  useEffect(() => {
    setLoading(true);

    // 선택 지수의 히스토리 + 신호
    const mainFetch = Promise.all([
      fetch('/api/market/overview').then(r => r.json()),
      fetch(`/api/market/risk/history?market=${market}&period=${period}`).then(r => r.json()),
      fetch(`/api/market/risk/signals?market=${market}`).then(r => r.json()),
    ]);

    // 모든 지수의 최신 위험도 (위험도 바용)
    const allIndices = [...KR_INDICES, ...US_INDICES];
    const riskFetches = Promise.all(
      allIndices.map(idx =>
        fetch(`/api/market/risk/signals?market=${idx.key}`)
          .then(r => r.json())
          .then(d => ({ key: idx.key, risk: d.current?.risk ?? 0 }))
          .catch(() => ({ key: idx.key, risk: 0 }))
      )
    );

    Promise.all([mainFetch, riskFetches])
      .then(([[ov, hist, sig], risks]) => {
        setOverview(ov);
        setRiskHistory(hist.data || []);
        setSignals(sig.signals || []);
        setCurrent(sig.current || null);
        const riskMap: Record<string, number> = {};
        for (const r of risks) riskMap[r.key] = r.risk;
        setAllRisks(riskMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [market, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>시장 데이터 불러오는 중...</span>
      </div>
    );
  }

  const upPct = overview ? Math.round((overview.upDown.up / overview.upDown.total) * 100) : 0;
  const downPct = overview ? Math.round((overview.upDown.down / overview.upDown.total) * 100) : 0;
  const latestRisk = current?.risk ?? 0;

  // 차트에 신호 마커 추가
  const chartData = riskHistory.map(p => {
    const sig = signals.find(s => s.date === p.date);
    return { ...p, signal: sig?.type || null, signalReason: sig?.reason || null };
  });

  return (
    <div className="space-y-4">
      {/* Country Tabs */}
      <div className="flex gap-2">
        {([['kr', '한국'], ['us', '미국']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setCountry(key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: country === key ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
              color: country === key ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: `1px solid ${country === key ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Risk Bars — 클릭 시 해당 지수 차트 전환 */}
      <div className={`grid grid-cols-1 ${indices.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
        {indices.map(idx => (
          <button key={idx.key} onClick={() => setMarket(idx.key)}
            className="text-left cursor-pointer rounded-xl transition-all"
            style={{ border: market === idx.key ? `2px solid ${getRiskColor(allRisks[idx.key] ?? 0)}` : '2px solid transparent' }}>
            <RiskBar label={`${idx.label} 위험도`} risk={allRisks[idx.key] ?? 0} max={100} />
          </button>
        ))}
      </div>

      {/* Risk Timeline Chart */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {marketLabel} 위험도 추이
          </h3>
          <div className="flex gap-1">
            {(['3m', '6m', '1y', '3y'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer"
                style={{
                  background: period === p ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: period === p ? 'var(--accent-blue)' : 'var(--text-muted)',
                }}>
                {p === '3m' ? '3개월' : p === '6m' ? '6개월' : p === '1y' ? '1년' : '3년'}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="30%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickFormatter={(d: string) => { const [, m, day] = d.split('-'); return `${parseInt(m)}/${parseInt(day)}`; }}
              interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: unknown) => [`${value}`, '위험도']}
              labelFormatter={(label: unknown) => {
                const d = String(label);
                const point = chartData.find(p => p.date === d);
                let extra = '';
                if (point?.signal === 'buy') extra = ' — 🟢 매수 신호';
                if (point?.signal === 'sell') extra = ' — 🔴 매도 신호';
                return d + extra;
              }}
            />
            {/* 구간 기준선 */}
            <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Area type="monotone" dataKey="risk" stroke={getRiskColor(latestRisk)} strokeWidth={2}
              fill="url(#riskGrad)" fillOpacity={1} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Signal Legend */}
        {signals.length > 0 && (
          <div className="flex gap-4 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>🟢 매수 신호 {signals.filter(s => s.type === 'buy').length}회</span>
            <span>🔴 매도 신호 {signals.filter(s => s.type === 'sell').length}회</span>
          </div>
        )}
      </div>

      {/* Current Recommendation */}
      {current && (
        <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: getRiskBg(current.risk), border: `1px solid ${getRiskColor(current.risk)}30` }}>
          <Wallet size={20} style={{ color: getRiskColor(current.risk) }} />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              현재 권장: 현금 {current.cashRecommend}% — {current.guide}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              근거: 위험도 {current.risk} ({getRiskLabel(current.risk)} 구간)
            </div>
          </div>
          <div className="text-2xl font-black" style={{ color: getRiskColor(current.risk) }}>
            {current.risk}
          </div>
        </div>
      )}

      {/* Up/Down + Signals */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Up/Down */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>등락 현황</h3>
            <div className="h-4 rounded-full flex overflow-hidden mb-3" style={{ background: 'var(--border)' }}>
              <div style={{ width: `${upPct}%`, background: 'var(--accent-green)' }} />
              <div style={{ width: `${100 - upPct - downPct}%`, background: 'var(--text-muted)', opacity: 0.3 }} />
              <div style={{ width: `${downPct}%`, background: 'var(--accent-red)' }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-black" style={{ color: 'var(--accent-green)' }}>{overview.upDown.up}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>상승 ({upPct}%)</div>
              </div>
              <div>
                <div className="text-lg font-black" style={{ color: 'var(--text-muted)' }}>{overview.upDown.flat}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>보합</div>
              </div>
              <div>
                <div className="text-lg font-black" style={{ color: 'var(--accent-red)' }}>{overview.upDown.down}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>하락 ({downPct}%)</div>
              </div>
            </div>
          </div>

          {/* Key Signals */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>주요 지표</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowUpRight size={14} style={{ color: overview.indices.kospiChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }} />
                  KOSPI 평균
                </span>
                <span className="text-sm font-bold" style={{ color: overview.indices.kospiChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {overview.indices.kospiChange >= 0 ? '+' : ''}{overview.indices.kospiChange}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {overview.indices.kosdaqChange >= 0 ? <ArrowUpRight size={14} style={{ color: 'var(--accent-green)' }} /> : <ArrowDownRight size={14} style={{ color: 'var(--accent-red)' }} />}
                  KOSDAQ 평균
                </span>
                <span className="text-sm font-bold" style={{ color: overview.indices.kosdaqChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {overview.indices.kosdaqChange >= 0 ? '+' : ''}{overview.indices.kosdaqChange}%
                </span>
              </div>
              <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Zap size={14} style={{ color: 'var(--accent-yellow)' }} /> 거래량 급증
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent-yellow)' }}>{overview.signals.volumeSpikes}개</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <RefreshCw size={14} style={{ color: 'var(--accent-green)' }} /> 흑자전환
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>{overview.signals.turnarounds}개</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
