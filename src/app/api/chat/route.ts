import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb, isLocalDb } from '@/lib/db';
import { systemPrompts } from '@/data/system-prompts';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── 종목명/코드 감지 → DB 데이터 조회 ───

function findStockCodes(text: string, db: ReturnType<typeof getDb>): string[] {
  const codes: string[] = [];

  // 1. 종목코드 직접 매칭 (6자리 숫자)
  const codeMatches = text.match(/\b\d{6}\b/g);
  if (codeMatches) {
    for (const c of codeMatches) {
      const row = db.prepare('SELECT code FROM stocks WHERE code = ?').get(c) as { code: string } | undefined;
      if (row) codes.push(row.code);
    }
  }

  // 2. 종목명 매칭
  const stocks = db.prepare('SELECT code, name FROM stocks').all() as Array<{ code: string; name: string }>;
  for (const s of stocks) {
    if (text.includes(s.name)) {
      if (!codes.includes(s.code)) codes.push(s.code);
    }
  }

  return codes.slice(0, 3); // 최대 3종목
}

function getStockContext(code: string, db: ReturnType<typeof getDb>): string {
  const stock = db.prepare('SELECT code, name, market FROM stocks WHERE code = ?').get(code) as { code: string; name: string; market: string } | undefined;
  if (!stock) return '';

  const parts: string[] = [];
  parts.push(`\n## ${stock.name} (${stock.code}, ${stock.market.toUpperCase()})`);

  // 최신 시세
  const price = db.prepare(`
    SELECT date, close, open, high, low, volume, market_cap, change_pct
    FROM daily_prices WHERE code = ? ORDER BY date DESC LIMIT 1
  `).get(code) as Record<string, number | string> | undefined;

  if (price) {
    parts.push(`\n### 최신 시세 (${price.date})`);
    parts.push(`현재가: ${Number(price.close).toLocaleString()}원 (${Number(price.change_pct) >= 0 ? '+' : ''}${Number(price.change_pct).toFixed(2)}%)`);
    parts.push(`시가총액: ${Number(price.market_cap).toLocaleString()}억원`);
    parts.push(`거래량: ${Number(price.volume).toLocaleString()}`);
  }

  // 기술적 지표 계산
  const prices60 = db.prepare(`
    SELECT date, close, volume FROM daily_prices
    WHERE code = ? ORDER BY date DESC LIMIT 60
  `).all(code) as Array<{ date: string; close: number; volume: number }>;

  if (prices60.length >= 20) {
    const closes = prices60.map(p => p.close);

    // MA
    const ma5 = closes.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const ma20 = closes.slice(0, 20).reduce((s, v) => s + v, 0) / 20;
    const ma60 = closes.length >= 60 ? closes.slice(0, 60).reduce((s, v) => s + v, 0) / 60 : null;

    // RSI (14일)
    let gains = 0, losses = 0;
    for (let i = 0; i < Math.min(14, closes.length - 1); i++) {
      const diff = closes[i] - closes[i + 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = losses > 0 ? gains / losses : 100;
    const rsi = 100 - (100 / (1 + rs));

    // MA 정배열 판정
    let maStatus = '혼재';
    if (ma60 && ma5 > ma20 && ma20 > ma60) maStatus = '정배열 (상승추세)';
    else if (ma60 && ma5 < ma20 && ma20 < ma60) maStatus = '역배열 (하락추세)';
    else if (ma5 > ma20) maStatus = '단기 상승';
    else maStatus = '단기 하락';

    // 볼린저 밴드 (20일)
    const avg20 = ma20;
    const std20 = Math.sqrt(closes.slice(0, 20).reduce((s, v) => s + (v - avg20) ** 2, 0) / 20);
    const bbUpper = Math.round(avg20 + 2 * std20);
    const bbLower = Math.round(avg20 - 2 * std20);
    const bbPosition = ((closes[0] - bbLower) / (bbUpper - bbLower) * 100).toFixed(0);

    // 거래량 변화
    const vol5 = prices60.slice(0, 5).reduce((s, p) => s + p.volume, 0) / 5;
    const vol20 = prices60.slice(0, 20).reduce((s, p) => s + p.volume, 0) / 20;
    const volRatio = (vol5 / vol20 * 100).toFixed(0);

    parts.push(`\n### 기술적 지표`);
    parts.push(`MA5: ${Math.round(ma5).toLocaleString()} | MA20: ${Math.round(ma20).toLocaleString()}${ma60 ? ` | MA60: ${Math.round(ma60).toLocaleString()}` : ''}`);
    parts.push(`MA 상태: ${maStatus}`);
    parts.push(`RSI(14): ${rsi.toFixed(1)} ${rsi > 70 ? '(과매수)' : rsi < 30 ? '(과매도)' : '(중립)'}`);
    parts.push(`볼린저밴드: 하단 ${bbLower.toLocaleString()} ~ 상단 ${bbUpper.toLocaleString()} (현재 위치 ${bbPosition}%)`);
    parts.push(`거래량 비율: 5일평균/20일평균 = ${volRatio}%`);
  }

  // 엔진 스코어
  const score = db.prepare(`
    SELECT total_score, verdict, layer1_score, layer2_score, layer3_score, layer4_score,
           confidence, reasons, risks
    FROM scores WHERE code = ? ORDER BY date DESC LIMIT 1
  `).get(code) as Record<string, unknown> | undefined;

  if (score) {
    let reasons: string[] = [];
    let risks: string[] = [];
    try { reasons = JSON.parse(score.reasons as string || '[]'); } catch { /* empty */ }
    try { risks = JSON.parse(score.risks as string || '[]'); } catch { /* empty */ }

    parts.push(`\n### 엔진 분석 결과`);
    parts.push(`총점: ${score.total_score}/100 | 판정: ${score.verdict} | 신뢰도: ${score.confidence}%`);
    parts.push(`Layer1(펀더멘털): ${score.layer1_score}/40 | Layer2(기술적): ${score.layer2_score}/30 | Layer3(거시): ${score.layer3_score}/20 | Layer4(계절성): ${score.layer4_score}/10`);
    if (reasons.length > 0) parts.push(`이유: ${reasons.join(', ')}`);
    if (risks.length > 0) parts.push(`리스크: ${risks.join(', ')}`);
  }

  // 재무제표 (최근 4분기)
  const fins = db.prepare(`
    SELECT period, revenue, operating_profit, net_income, roe, per, pbr, debt_ratio, is_estimate
    FROM financials WHERE code = ? AND period_type = 'quarter'
    ORDER BY period DESC LIMIT 4
  `).all(code) as Array<Record<string, unknown>>;

  if (fins.length > 0) {
    parts.push(`\n### 분기 실적 (억원)`);
    parts.push(`| 분기 | 매출액 | 영업이익 | 순이익 | ROE | PER | 부채비율 |`);
    parts.push(`|------|--------|---------|--------|-----|-----|---------|`);
    for (const f of fins) {
      const est = f.is_estimate ? '(E)' : '';
      parts.push(`| ${f.period}${est} | ${(f.revenue as number || 0).toLocaleString()} | ${(f.operating_profit as number || 0).toLocaleString()} | ${(f.net_income as number || 0).toLocaleString()} | ${f.roe ?? 'N/A'} | ${f.per ?? 'N/A'} | ${f.debt_ratio ?? 'N/A'} |`);
    }
  }

  // 컨센서스
  const consensus = db.prepare(`
    SELECT rating, target_price, analyst_count FROM consensus WHERE code = ?
  `).get(code) as { rating: number; target_price: number; analyst_count: number } | undefined;

  if (consensus) {
    parts.push(`\n### 증권사 컨센서스`);
    parts.push(`투자의견: ${consensus.rating}/5.0 | 목표주가: ${consensus.target_price?.toLocaleString()}원 | 커버리지: ${consensus.analyst_count}개 증권사`);
    if (price) {
      const upside = ((consensus.target_price - Number(price.close)) / Number(price.close) * 100).toFixed(1);
      parts.push(`현재가 대비 상승여력: ${upside}%`);
    }
  }

  // 괴리율
  const allFins = db.prepare(`
    SELECT net_income FROM financials WHERE code = ? AND period_type = 'quarter' ORDER BY period DESC LIMIT 8
  `).all(code) as Array<{ net_income: number }>;

  if (allFins.length >= 2 && price) {
    let niChange: number;
    if (allFins.length >= 8) {
      niChange = allFins.slice(0, 4).reduce((s, q) => s + (q.net_income || 0), 0)
        - allFins.slice(4, 8).reduce((s, q) => s + (q.net_income || 0), 0);
    } else {
      niChange = (allFins[0].net_income || 0) - (allFins[1].net_income || 0);
    }

    const yearAgo = db.prepare(`
      SELECT market_cap FROM daily_prices WHERE code = ? AND market_cap > 0 ORDER BY date ASC LIMIT 1
    `).get(code) as { market_cap: number } | undefined;

    if (yearAgo) {
      const mcapChange = Number(price.market_cap) - yearAgo.market_cap;
      const niGap = (niChange * 10) - mcapChange;
      const niGapRatio = (niGap / Number(price.market_cap) * 100).toFixed(1);
      parts.push(`\n### 저평가 분석 (증감액 기반)`);
      parts.push(`순이익 증감: ${niChange >= 0 ? '+' : ''}${niChange.toLocaleString()}억원`);
      parts.push(`시총 증감: ${mcapChange >= 0 ? '+' : ''}${mcapChange.toLocaleString()}억원`);
      parts.push(`시총대비 괴리비율: ${niGapRatio}% ${Number(niGapRatio) > 0 ? '(저평가)' : '(고평가)'}`);
    }
  }

  return parts.join('\n');
}

// ─── API 핸들러 ───

export async function POST(req: NextRequest) {
  try {
    const { category, messages } = await req.json();

    const systemPrompt = systemPrompts[category];
    if (!systemPrompt) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // 최신 사용자 메시지에서 종목 감지
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
    let stockContext = '';

    if (lastUserMsg && isLocalDb()) {
      try {
        const db = getDb();
        const codes = findStockCodes(lastUserMsg.content, db);

        if (codes.length > 0) {
          stockContext = '\n\n---\n# 리치고 DB 실시간 데이터\n아래는 사용자가 언급한 종목의 실제 데이터입니다. 이 데이터를 기반으로 답변하세요.\n';
          for (const code of codes) {
            stockContext += getStockContext(code, db);
          }
          stockContext += '\n\n---\n위 데이터는 리치고 두뇌엔진 brain.db에서 실시간 조회한 결과입니다. 이 데이터를 근거로 구체적으로 답변하세요.';
        }
      } catch {
        // brain.db not available — continue without stock context
      }
    }

    const fullSystemPrompt = systemPrompt + stockContext;

    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: fullSystemPrompt,
      messages: anthropicMessages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    return NextResponse.json({ content: text });
  } catch (error: unknown) {
    console.error('Chat API error:', error);

    const apiError = error as { status?: number; error?: { message?: string } };
    const msg = apiError?.error?.message || '';

    if (msg.includes('credit balance')) {
      return NextResponse.json(
        { error: 'API 크레딧이 부족합니다. Anthropic 대시보드에서 크레딧을 충전해주세요.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: 'AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
