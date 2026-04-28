import { Suspense } from 'react';
import { MapLive } from '@/components/map/MapLive';

export const dynamic = 'force-dynamic';

export default function MapPage() {
  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          투자 지도
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          순이익은 늘었는데 주가는 안 따라온 종목을 한눈에 — 우하단 분면이 저평가 발굴 영역입니다
        </p>
      </div>
      <Suspense fallback={<div className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</div>}>
        <MapLive />
      </Suspense>
    </div>
  );
}
