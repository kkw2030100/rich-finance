import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    // 최신 날짜
    const latestDate = (db.prepare('SELECT MAX(date) as d FROM daily_prices').get() as { d: string }).d;

    // 상승/하락 종목 수
    const upDown = db.prepare(`
      SELECT
        SUM(CASE WHEN change_pct > 0 THEN 1 ELSE 0 END) as up_count,
        SUM(CASE WHEN change_pct < 0 THEN 1 ELSE 0 END) as down_count,
        SUM(CASE WHEN change_pct = 0 THEN 1 ELSE 0 END) as flat_count,
        SUM(CASE WHEN change_pct >= 29 THEN 1 ELSE 0 END) as up_limit,
        SUM(CASE WHEN change_pct <= -29 THEN 1 ELSE 0 END) as down_limit,
        COUNT(*) as total
      FROM daily_prices WHERE date = ?
    `).get(latestDate) as {
      up_count: number; down_count: number; flat_count: number;
      up_limit: number; down_limit: number; total: number;
    };

    // 코스피/코스닥 대표 지수 (시총 상위 종목들의 평균 등락률로 근사)
    const kospiAvg = db.prepare(`
      SELECT AVG(dp.change_pct) as avg_change
      FROM daily_prices dp
      JOIN stocks s ON dp.code = s.code
      WHERE dp.date = ? AND s.market = 'kospi'
      ORDER BY dp.market_cap DESC LIMIT 100
    `).get(latestDate) as { avg_change: number };

    const kosdaqAvg = db.prepare(`
      SELECT AVG(dp.change_pct) as avg_change
      FROM daily_prices dp
      JOIN stocks s ON dp.code = s.code
      WHERE dp.date = ? AND s.market = 'kosdaq'
      ORDER BY dp.market_cap DESC LIMIT 100
    `).get(latestDate) as { avg_change: number };

    // 거래량 급증 종목 (20일 평균 대비 300%+)
    const volumeSpikes = db.prepare(`
      SELECT COUNT(*) as cnt FROM (
        SELECT dp.code, dp.volume,
          (SELECT AVG(volume) FROM daily_prices WHERE code = dp.code AND date < dp.date ORDER BY date DESC LIMIT 20) as avg_vol
        FROM daily_prices dp
        WHERE dp.date = ?
      ) WHERE volume > avg_vol * 3 AND avg_vol > 0
    `).get(latestDate) as { cnt: number };

    // 흑자전환 종목 (최근 분기 vs 전분기)
    const turnarounds = db.prepare(`
      SELECT COUNT(DISTINCT f1.code) as cnt
      FROM financials f1
      JOIN financials f2 ON f1.code = f2.code AND f2.period_type = 'quarter'
      WHERE f1.period_type = 'quarter'
        AND f1.net_income > 0
        AND f2.net_income < 0
        AND f1.period > f2.period
        AND f1.period = (SELECT MAX(period) FROM financials WHERE code = f1.code AND period_type = 'quarter')
        AND f2.period = (SELECT MAX(period) FROM financials WHERE code = f2.code AND period_type = 'quarter' AND period < f1.period)
    `).get() as { cnt: number };

    // 시장 온도 (1~5, 상승비율 기반)
    const upRatio = upDown.up_count / upDown.total;
    let marketTemp = 3;
    if (upRatio >= 0.65) marketTemp = 5;
    else if (upRatio >= 0.55) marketTemp = 4;
    else if (upRatio >= 0.45) marketTemp = 3;
    else if (upRatio >= 0.35) marketTemp = 2;
    else marketTemp = 1;

    const tempLabels = ['', '매우 불안', '불안', '중립', '양호', '과열'];

    // 시장 폭 (상승-하락 차이)
    const breadth = upDown.up_count - upDown.down_count;
    let breadthScore = 3;
    if (breadth > 200) breadthScore = 5;
    else if (breadth > 50) breadthScore = 4;
    else if (breadth > -50) breadthScore = 3;
    else if (breadth > -200) breadthScore = 2;
    else breadthScore = 1;

    const breadthLabels = ['', '극약세', '약세', '중립', '양호', '강세'];

    // 계절성 (현재 월 기준)
    const month = new Date().getMonth() + 1;
    const isHeaven = month >= 11 || month <= 4;
    const seasonScore = isHeaven ? 7 : (month === 7 ? 5 : (month >= 8 && month <= 9 ? 2 : 4));

    return NextResponse.json({
      date: latestDate,
      marketTemp: { score: marketTemp, max: 5, label: tempLabels[marketTemp] },
      marketBreadth: { score: breadthScore, max: 5, label: breadthLabels[breadthScore] },
      seasonality: { score: seasonScore, max: 10, label: `${month}월` },
      upDown: {
        up: upDown.up_count,
        down: upDown.down_count,
        flat: upDown.flat_count,
        upLimit: upDown.up_limit,
        downLimit: upDown.down_limit,
        total: upDown.total,
      },
      indices: {
        kospiChange: Math.round((kospiAvg.avg_change || 0) * 100) / 100,
        kosdaqChange: Math.round((kosdaqAvg.avg_change || 0) * 100) / 100,
      },
      signals: {
        volumeSpikes: volumeSpikes.cnt,
        turnarounds: turnarounds.cnt,
      },
    });
  } catch (error) {
    console.error('Market overview error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
