import { StockScatter } from '@/components/stocks/StockScatter';
import { StockTable } from '@/components/stocks/StockTable';

export default function StocksPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          종목 탐색
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          순이익 증감율 vs 시총 증감율 — 우측 하단이 저평가 구간
        </p>
      </div>

      {/* Scatter Plot */}
      <div className="mb-6">
        <StockScatter />
      </div>

      {/* Stock Table */}
      <StockTable />
    </div>
  );
}
