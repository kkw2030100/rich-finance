import { StockDetailLive } from '@/components/stocks/StockDetailLive';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return <StockDetailLive code={ticker} />;
}
