import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { systemPrompts } from '@/data/system-prompts';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { category, messages } = await req.json();

    const systemPrompt = systemPrompts[category];
    if (!systemPrompt) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
