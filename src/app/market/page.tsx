import { MarketRiskCard } from '@/components/home/MarketRiskCard';
import { SeasonalityCard } from '@/components/home/SeasonalityCard';
import { MarketLive } from '@/components/market/MarketLive';

export const dynamic = 'force-dynamic';

export default function MarketPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          시장 현황
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          시장 위험도 + 계절성 + 거시경제 종합 진단
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <MarketRiskCard />
        </div>
        <SeasonalityCard />
      </div>

      <MarketLive />
    </div>
  );
}
