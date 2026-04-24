import { NextResponse } from 'next/server';
import { callPython } from '@/lib/python-bridge';
import { isLocalDb } from '@/lib/db';
import { supaMarketRisk } from '@/lib/db-supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isLocalDb()) {
      const data = await supaMarketRisk();
      return NextResponse.json(data);
    }

    const data = callPython(`
from engine.market_risk import get_all_market_risks
import json
result = get_all_market_risks()
print(json.dumps(result, ensure_ascii=False, default=str))
`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Market risk API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
