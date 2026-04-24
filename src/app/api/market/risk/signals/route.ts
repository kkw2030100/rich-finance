import { NextRequest, NextResponse } from 'next/server';
import { callPython } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') || 'kospi';

    const data = callPython(`
from engine.market_risk_history import calc_risk_history
from engine.rebalance_signal import generate_signals, calc_suggested_cash_ratio
import json

history = calc_risk_history('${market}', sample_every=5)
signals = generate_signals(history)
latest = history[-1] if history else {"risk": 50, "date": "N/A"}
suggestion = calc_suggested_cash_ratio(latest["risk"], '${market}')

result = {
    "current": {
        "risk": latest["risk"],
        "date": latest["date"],
        "cash_pct": suggestion["cash_pct"],
        "action": suggestion["action"],
        "color": suggestion["color"],
    },
    "signals": signals[-20:],
    "totalSignals": len(signals),
}
print(json.dumps(result, ensure_ascii=False))
`, 60000);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Risk signals API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
