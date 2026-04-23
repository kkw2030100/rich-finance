import { ScreenerLive } from '@/components/screener/ScreenerLive';

export const dynamic = 'force-dynamic';

export default function ScreenerPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          저평가 스크리너
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          4가지 관점으로 저평가 종목을 탐색합니다
        </p>
      </div>
      <ScreenerLive />
    </div>
  );
}
