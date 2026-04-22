'use client';

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { mockStocks, getVerdictColor } from '@/data/mock-stocks';

interface DataPoint {
  name: string;
  ticker: string;
  x: number;  // 순이익 증감율
  y: number;  // 시총 증감율
  z: number;  // 시총 (버블 크기)
  verdict: string;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DataPoint }> }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{d.name} ({d.ticker})</div>
      <div style={{ color: 'var(--text-secondary)' }}>
        순이익 증감: <span style={{ color: d.x >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {d.x >= 0 ? '+' : ''}{d.x.toFixed(1)}%
        </span>
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        시총 증감: <span style={{ color: d.y >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {d.y >= 0 ? '+' : ''}{d.y.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export function StockScatter() {
  const data: DataPoint[] = mockStocks
    .filter(s => !s.killZone)
    .map(s => ({
      name: s.name,
      ticker: s.ticker,
      x: s.financials.netIncomeGrowth,
      y: s.financials.marketCapGrowth,
      z: Math.sqrt(s.financials.marketCap / 1e6) * 2,
      verdict: s.verdict.verdict,
    }));

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>저평가 분포도</h3>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            X: 순이익 증감율 | Y: 시총 증감율 | 대각선 아래 = 저평가
          </p>
        </div>
        <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} /> Buy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#facc15' }} /> Hold</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /> Sell</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" dataKey="x" name="순이익 증감"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            label={{ value: '순이익 증감율 (%)', position: 'bottom', offset: 5, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis type="number" dataKey="y" name="시총 증감"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            label={{ value: '시총 증감율 (%)', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine segment={[{ x: -100, y: -100 }, { x: 350, y: 350 }]}
            stroke="rgba(255,255,255,0.08)" strokeDasharray="5 5" />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={getVerdictColor(d.verdict)} fillOpacity={0.75} r={Math.max(d.z, 5)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
