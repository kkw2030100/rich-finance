import { NextResponse } from 'next/server';
import { callPython } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
