import { MarketLive } from '@/components/market/MarketLive';

export const dynamic = 'force-dynamic';

export default function MarketPage() {
  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          시장 현황
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          시장 위험도 시계열 + 리밸런싱 신호 + 권장 현금 비중
        </p>
      </div>

      <MarketLive />
    </div>
  );
}
