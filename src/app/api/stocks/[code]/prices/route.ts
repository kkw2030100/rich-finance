import { NextRequest, NextResponse } from 'next/server';
import { getDb, isLocalDb } from '@/lib/db';
import { supaPrices } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const days = parseInt(req.nextUrl.searchParams.get('days') || '60');

  if (!isLocalDb()) {
    const data = await supaPrices(code, days);
    return NextResponse.json(data);
  }

  const db = getDb();

  const rows = db.prepare(`
    SELECT date, open, high, low, close, volume, market_cap, change_pct
    FROM daily_prices WHERE code = ? ORDER BY date DESC LIMIT ?
  `).all(code, days);

  return NextResponse.json(rows);
}
