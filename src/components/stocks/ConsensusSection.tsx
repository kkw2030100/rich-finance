'use client';

import { useState, useEffect, useMemo } from 'react';
import { Star, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ComposedChart, CartesianGrid } from 'recharts';

interface Analyst {
  provider: string;
  date: string;
  targetPrice: number;
  prevTargetPrice: number | null;
  changePct: number | null;
  opinion: string;
  weight: number;
}

interface ConsensusData {
  code: string;
  rating: number;
  targetPrice: number;
  targetPriceWeighted: number;
  consensusEps: number;
  consensusPer: number;
  analystCount: number;
  recentCount: number;
  currentPrice: number;
  upside: number | null;
  analysts: Analyst[];
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14}
          fill={i < full ? '#facc15' : (i === full && half ? '#facc15' : 'none')}
          stroke={i < full || (i === full && half) ? '#facc15' : 'var(--text-muted)'}
          style={i === full && half ? { clipPath: 'inset(0 50% 0 0)' } : {}}
        />
      ))}
      <span className="ml-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{(rating ?? 0).toFixed(1)}</span>
    </span>
  );
}

export function ConsensusSection({ code }: { code: string }) {
  const [data, setData] = useState<ConsensusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOlder, setShowOlder] = useState(false);

  useEffect(() => {
    fetch(`/api/stocks/${code}/consensus`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="rounded-xl p-4 flex items-center justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>증권사 의견 불러오는 중...</span>
      </div>
    );
  }

  if (!data) return null;

  const recentAnalysts = data.analysts.filter(a => a.weight === 1.0);
  const midAnalysts = data.analysts.filter(a => a.weight === 0.5);
  const isUpside = (data.upside ?? 0) > 0;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>증권사 의견</h3>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>투자의견</div>
          <RatingStars rating={data.rating} />
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{data.analystCount}개 증권사</div>
        </div>

        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>목표주가 (가중평균)</div>
          <div className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
            {(data.targetPriceWeighted ?? 0).toLocaleString()}원
          </div>
          <div className="text-[10px] flex items-center gap-0.5" style={{ color: isUpside ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {isUpside ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            현재가 대비 {data.upside !== null ? (data.upside > 0 ? '+' : '') + data.upside + '%' : 'N/A'}
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>컨센서스 EPS</div>
          <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {data.consensusEps?.toLocaleString() || 'N/A'}원
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>컨센서스 PER</div>
          <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {data.consensusPer?.toFixed(2) || 'N/A'}배
          </div>
        </div>
      </div>

      {/* Recent Analysts (3개월 이내) */}
      {recentAnalysts.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            최근 3개월 이내 ({recentAnalysts.length}건)
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="text-left px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>증권사</th>
                  <th className="text-center px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>날짜</th>
                  <th className="text-right px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>목표가</th>
                  <th className="text-center px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>의견</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalysts.map((a, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{a.provider}</td>
                    <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{a.date}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold" style={{ color: 'var(--text-primary)' }}>
                      {(a.targetPrice ?? 0).toLocaleString()}원
                    </td>
                    <td className="px-3 py-2 text-xs text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          background: a.opinion?.includes('매수') || a.opinion?.includes('BUY') ? 'rgba(34,197,94,0.15)' : 'rgba(250,204,21,0.15)',
                          color: a.opinion?.includes('매수') || a.opinion?.includes('BUY') ? 'var(--accent-green)' : 'var(--accent-yellow)',
                        }}>
                        {a.opinion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Older Analysts (3~6개월) */}
      {midAnalysts.length > 0 && (
        <div>
          <button onClick={() => setShowOlder(!showOlder)}
            className="flex items-center gap-1 text-xs cursor-pointer mb-2"
            style={{ color: 'var(--text-muted)' }}>
            {showOlder ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            3~6개월 의견 {showOlder ? '접기' : '더보기'} ({midAnalysts.length}건)
          </button>
          {showOlder && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', opacity: 0.7 }}>
              <table className="w-full">
                <tbody>
                  {midAnalysts.map((a, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{a.provider}</td>
                      <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{a.date}</td>
                      <td className="px-3 py-2 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>
                        {(a.targetPrice ?? 0).toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{a.opinion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
        증권사 의견은 참고 자료 · 목표가는 위 캔들 차트에 표시됩니다 · 투자 판단의 책임은 본인에게 있습니다
      </div>
    </div>
  );
}

// ─── 주가 + 목표가 오버레이 차트 ───
function TargetPriceChart({ code, analysts, targetPriceWeighted, currentPrice }: {
  code: string;
  analysts: Analyst[];
  targetPriceWeighted: number;
  currentPrice: number;
}) {
  const [prices, setPrices] = useState<Array<{ date: string; close: number }>>([]);

  useEffect(() => {
    fetch(`/api/stocks/${code}/prices?days=90`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPrices(Array.isArray(d) ? d : d.data || []))
      .catch(() => setPrices([]));
  }, [code]);

  // 목표가 점 데이터 생성
  const chartData = useMemo(() => {
    if (prices.length === 0) return [];

    const priceMap = new Map(prices.map(p => [p.date, p.close]));

    // 주가 데이터
    const data = prices.map(p => ({
      date: p.date.slice(5), // "04-23"
      fullDate: p.date,
      close: p.close,
      target: null as number | null,
      provider: null as string | null,
      weight: null as number | null,
    }));

    // 목표가 점 매핑
    for (const a of analysts) {
      if (!a.date || !a.targetPrice) continue;
      const parts = a.date.split('/');
      if (parts.length !== 3) continue;
      const isoDate = `20${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;

      // 가장 가까운 거래일 찾기
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < data.length; i++) {
        const diff = Math.abs(new Date(data[i].fullDate).getTime() - new Date(isoDate).getTime());
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }

      if (bestIdx >= 0 && bestDiff < 7 * 24 * 3600 * 1000) {
        // 같은 날에 여러 증권사 → 별도 엔트리
        data.push({
          date: data[bestIdx].date,
          fullDate: data[bestIdx].fullDate,
          close: data[bestIdx].close,
          target: a.targetPrice,
          provider: a.provider,
          weight: a.weight,
        });
      }
    }

    return data.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [prices, analysts]);

  if (chartData.length === 0) return null;

  const allValues = chartData.flatMap(d => [d.close, d.target].filter((v): v is number => v !== null && v > 0));
  const yMin = Math.floor(Math.min(...allValues) * 0.9);
  const yMax = Math.ceil(Math.max(...allValues) * 1.05);

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        주가 + 증권사 목표가
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickFormatter={(v: number) => v >= 10000 ? (v / 10000).toFixed(0) + '만' : v.toLocaleString()} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              if (name === 'close') return [v.toLocaleString() + '원', '주가'];
              return [v.toLocaleString() + '원', '목표가'];
            }}
            labelFormatter={(label: unknown) => String(label)}
          />
          {/* 가중 평균 목표가 점선 */}
          <ReferenceLine y={targetPriceWeighted ?? 0} stroke="#22c55e" strokeDasharray="6 3"
            label={{ value: `목표 ${(targetPriceWeighted ?? 0).toLocaleString()}`, position: 'right', fontSize: 10, fill: '#22c55e' }} />
          {/* 주가 라인 */}
          <Line type="monotone" dataKey="close" stroke="var(--accent-blue)" strokeWidth={2} dot={false} connectNulls />
          {/* 목표가 점 */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Scatter dataKey="target" fill="#22c55e" shape={((props: any) => {
            if (!props.payload?.target) return null;
            const w = props.payload.weight;
            const r = w === 1 ? 5 : w === 0.5 ? 3.5 : 2;
            const opacity = w === 1 ? 1 : w === 0.5 ? 0.6 : 0.3;
            const color = (props.payload.target ?? 0) >= currentPrice ? '#22c55e' : '#ef4444';
            return <circle cx={props.cx} cy={props.cy} r={r} fill={color} opacity={opacity} />;
          }) as any} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1"><span style={{ width: 20, height: 2, background: 'var(--accent-blue)', display: 'inline-block' }} /> 주가</span>
        <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> 목표가 (현재가 위)</span>
        <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> 목표가 (현재가 아래)</span>
        <span className="flex items-center gap-1"><span style={{ width: 20, height: 0, borderTop: '2px dashed #22c55e', display: 'inline-block' }} /> 가중평균</span>
      </div>
    </div>
  );
}
