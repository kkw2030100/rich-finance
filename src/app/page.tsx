import { MarketRiskCard } from '@/components/home/MarketRiskCard';
import { TopPicks } from '@/components/home/TopPicks';
import { SectorOverview } from '@/components/home/SectorOverview';
import { SeasonalityCard } from '@/components/home/SeasonalityCard';
import { FavoriteStocks } from '@/components/home/FavoriteStocks';
import { getTopPicks } from '@/lib/queries/stocks';

export const revalidate = 300; // 5분 캐시

export default async function HomePage() {
  const topPicks = await getTopPicks(8);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          오늘의 시장
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          순이익이 성장한 만큼 주가가 따라오지 않은 종목을 찾습니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <MarketRiskCard />
        </div>
        <SeasonalityCard />
      </div>

      <div className="mb-6">
        <FavoriteStocks />
      </div>

      <div className="mb-6">
        <TopPicks stocks={topPicks} />
      </div>

      <SectorOverview />
    </div>
  );
}
