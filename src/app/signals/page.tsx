import { SignalsLive } from '@/components/signals/SignalsLive';

export const dynamic = 'force-dynamic';

export default function SignalsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          특수 신호
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          흑자전환, 거래량 급증, 괴리율 상위 종목 자동 감지
        </p>
      </div>
      <SignalsLive />
    </div>
  );
}
