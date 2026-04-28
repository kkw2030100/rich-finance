import { Suspense } from 'react';
import { ScreenerLive } from '@/components/screener/ScreenerLive';

export const dynamic = 'force-dynamic';

export default function ScreenerPage() {
  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          투자 종목 발굴
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          저평가부터 본격 상승 초기 종목까지, 6가지 관점으로 발굴합니다
        </p>
      </div>
      <Suspense fallback={<div className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</div>}>
        <ScreenerLive />
      </Suspense>
    </div>
  );
}
