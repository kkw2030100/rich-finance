import { NextRequest, NextResponse } from 'next/server';
import { callPython } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') || 'kospi';
    const period = req.nextUrl.searchParams.get('period') || '1y';

    const sampleMap: Record<string, number> = { '3m': 3, '6m': 5, '1y': 5, '3y': 10 };
    const sampleEvery = sampleMap[period] || 5;

    const daysMap: Record<string, number> = { '3m': 65, '6m': 130, '1y': 260, '3y': 780 };
    const maxPoints = Math.ceil((daysMap[period] || 260) / sampleEvery);

    const data = callPython(`
from engine.market_risk_history import calc_risk_history
import json
history = calc_risk_history('${market}', sample_every=${sampleEvery})
result = history[-${maxPoints}:] if len(history) > ${maxPoints} else history
print(json.dumps({"market": "${market}", "period": "${period}", "data": result}, ensure_ascii=False))
`, 60000);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Risk history API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
