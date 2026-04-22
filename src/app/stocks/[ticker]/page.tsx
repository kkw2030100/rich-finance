import { mockStocks } from '@/data/mock-stocks';
import { StockDetail } from '@/components/stocks/StockDetail';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return mockStocks.map(s => ({ ticker: s.ticker }));
}

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const stock = mockStocks.find(s => s.ticker === ticker);
  if (!stock) notFound();
  return <StockDetail stock={stock} />;
}
