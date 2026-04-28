import { Suspense } from 'react';
import { PortfolioLive } from '@/components/portfolio/PortfolioLive';

export const dynamic = 'force-dynamic';

export default function PortfolioPage() {
  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          내 포트폴리오
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          보유 종목의 현재 단계 + 매도 시그널을 한눈에. 백테스트 검증된 매도 전략을 자동 추천.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</div>}>
        <PortfolioLive />
      </Suspense>
    </div>
  );
}
