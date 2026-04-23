'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { ChatCategory } from '@/data/chat-categories';
import { useChatHistory } from '@/lib/useChatHistory';

// Mock AI responses per category
function getMockResponse(category: string, question: string): string {
  const q = question.toLowerCase();

  if (category === 'value') {
    if (q.includes('사이클') || q.includes('바닥'))
      return '사이클 바닥을 판단하려면 업종 전체의 실적 흐름을 봐야 합니다. 핵심은 적자에서 흑자로 전환하는 시점이에요. 시멘트, 조선, 건설처럼 경기에 민감한 업종은 보통 4~7년 주기로 바닥과 천장을 반복합니다. 바닥 근처에서는 대부분의 투자자가 관심을 끊기 때문에 오히려 좋은 매수 기회가 됩니다.';
    if (q.includes('pbr') || q.includes('저평가'))
      return 'PBR 1배 이하라는 것은 시장이 이 회사의 자산가치보다 낮게 평가하고 있다는 뜻이에요. 하지만 PBR만 보면 안 됩니다. 영업이익이 꾸준히 나오는지, 현금흐름이 건강한지, 자본잠식은 없는지를 함께 확인하세요. PBR이 낮은데 ROE도 높다면 그건 진짜 저평가일 가능성이 높습니다.';
    return '가치투자의 핵심은 "싸게 사서 기다리는 것"입니다. 하지만 그냥 싼 게 아니라, 펀더멘털이 탄탄한데 시장이 아직 그 가치를 인정하지 않은 종목을 찾아야 해요. 순이익이 성장하는데 시가총액이 따라오지 않은 종목이 바로 저평가 후보입니다. 핵심 지표는 PER, PBR, ROE, 그리고 현금흐름 패턴이에요.';
  }

  if (category === 'chart') {
    if (q.includes('추세') || q.includes('전환'))
      return '추세 전환을 확인하는 가장 검증된 방법은 1-2-3 규칙입니다. 첫째, 가격이 추세선을 이탈합니다. 둘째, 반등하지만 이전 고점을 넘지 못합니다. 셋째, 직전 저점을 하향 돌파합니다. 이 세 가지가 모두 나타나면 추세 전환이 확인된 것으로 봅니다. 성급하게 판단하지 말고, 확인을 기다리세요.';
    if (q.includes('골든') || q.includes('크로스'))
      return '골든크로스는 단기 이동평균선이 장기 이동평균선을 위로 돌파하는 것인데, 단독으로 매수 신호로 쓰기엔 부족합니다. 이동평균선은 후행 지표라서 이미 상당 부분 올라간 후에 신호가 나옵니다. 거래량이 동반되는지, 전체 추세와 맞는 방향인지를 함께 확인하세요.';
    return '기술적 분석은 예측 도구가 아니라 대응 도구입니다. "내일 어디로 갈지" 맞히려고 하면 안 되고, "지금 추세가 유지되고 있는가, 꺾이고 있는가"를 확인하는 용도로 써야 합니다. RSI, MACD, 볼린저 밴드 같은 보조지표는 말 그대로 보조입니다. 가격과 거래량이 가장 중요합니다.';
  }

  if (category === 'financial') {
    if (q.includes('먼저') || q.includes('처음'))
      return '재무제표를 처음 볼 때는 이 순서를 추천합니다. 1) 영업이익이 흑자인가? 2) 영업이익이 성장하고 있는가? 3) 부채비율은 적정한가? 4) 영업활동 현금흐름이 양수인가? 이 네 가지만 확인해도 위험한 종목의 80%는 걸러낼 수 있어요.';
    if (q.includes('분식') || q.includes('회계'))
      return '분식회계를 의심해야 하는 대표적 신호 5가지가 있습니다. 1) 매출채권이 매출보다 빠르게 증가 2) 영업이익은 흑자인데 영업현금흐름은 계속 마이너스 3) 감사의견이 적정이 아님 4) 전환사채를 반복 발행 5) 재고자산이 비정상적으로 급증. 이 중 2개 이상 해당되면 투자를 피하세요.';
    return '재무제표를 볼 때 가장 중요한 원칙은 "이익은 의견이고, 현금은 팩트"라는 것입니다. 손익계산서의 이익은 회계 처리 방법에 따라 달라질 수 있지만, 현금흐름표의 현금은 조작이 어렵습니다. 영업활동 현금흐름이 꾸준히 양수인지를 꼭 확인하세요.';
  }

  if (category === 'timing') {
    if (q.includes('들어가') || q.includes('시점'))
      return '시장에 들어갈 타이밍은 감으로 정하면 안 됩니다. 확인할 것은 세 가지입니다. 1) 시장 위험도가 어느 수준인가 2) 계절성 패턴이 유리한 구간인가 3) 금리 방향이 어디를 향하고 있는가. 이 세 가지가 모두 긍정적이면 적극 접근, 하나라도 부정적이면 분할 접근이 안전합니다.';
    if (q.includes('금리'))
      return '금리 인하가 시작되면 일반적으로 주식시장에 긍정적입니다. 유동성이 풀리면서 자산 가격이 올라가는 경향이 있어요. 특히 성장주와 기술주가 먼저 반응하고, 이후 가치주로 확산됩니다. 다만 금리를 내리는 이유가 경기침체 때문이라면 주의가 필요합니다.';
    return '타이밍을 맞추려고 하지 마세요. 대신 시장 상황에 따라 대응하세요. 평시에는 리밸런싱으로 비중을 관리하고, 폭락이 오면 단계적으로 매수하고, 급등하면 일부 이익을 실현합니다. 예측이 아니라 규칙이 중요합니다.';
  }

  if (category === 'mindset') {
    if (q.includes('손절'))
      return '손절이 어려운 이유는 "틀렸다"를 인정하기 싫기 때문입니다. 하지만 손절은 실패가 아니라 규칙을 지키는 비용이에요. 진입하기 전에 "여기까지 내려가면 나간다"는 라인을 미리 정하세요. 그리고 그 라인에 도달하면 예외 없이 실행하세요. 다리 하나를 잃는 것이 온몸을 잃는 것보다 낫습니다.';
    if (q.includes('물타기'))
      return '물타기는 평균단가를 낮추는 게 아니라, 잘못하면 실수의 비중을 키우는 행동입니다. 하락 중 물타기보다는, 하락이 멈추고 반등이 확인된 자리에서 재진입하는 것이 훨씬 안전합니다. 특히 초보자일수록 물타기는 금지에 가깝습니다.';
    return '투자에서 가장 중요한 한 가지를 꼽으면, 예측보다 규칙을 끝까지 지키는 능력입니다. 대부분은 뭘 사야 할지 몰라서가 아니라, 원래 정한 원칙을 못 지켜서 무너집니다. 수익률보다 먼저 손실 통제, 확신보다 규칙, 예측보다 반복 가능성을 추구하세요.';
  }

  return '좋은 질문이에요. 투자에서 가장 중요한 것은 자신만의 원칙을 세우고 지키는 것입니다. 구체적인 상황을 더 알려주시면 더 깊은 이야기를 나눌 수 있어요.';
}

export function ChatRoom({ category }: { category: ChatCategory }) {
  const { messages, addMessage, clearHistory, loaded } = useChatHistory(category.id);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput('');
    addMessage('user', text);
    setIsTyping(true);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const response = getMockResponse(category.id, text);
    addMessage('assistant', response);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (q: string) => {
    setInput(q);
    inputRef.current?.focus();
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.emoji}</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{category.name}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{category.description}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Trash2 size={12} />
            대화 지우기
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-5xl mb-4">{category.emoji}</span>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {category.name}에게 물어보세요
            </h2>
            <p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
              {category.description}에 대해 궁금한 것을 자유롭게 질문하세요
            </p>

            {/* Suggested Questions */}
            <div className="w-full max-w-lg space-y-2">
              {category.suggestedQuestions.map((q, i) => (
                <button key={i} onClick={() => handleSuggestion(q)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm card-hover cursor-pointer"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <Sparkles size={12} className="inline mr-2" style={{ color: category.color }} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{category.emoji}</span>
                      <span className="text-[10px] font-semibold" style={{ color: category.color }}>{category.name}</span>
                    </div>
                  )}
                  <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user' ? `${category.color}20` : 'var(--bg-card)',
                      border: `1px solid ${msg.role === 'user' ? `${category.color}40` : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                      borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                      borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                    }}>
                    {msg.content}
                  </div>
                  <div className="text-[10px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: category.color, animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: category.color, animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: category.color, animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${category.name}에게 질문하세요...`}
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            disabled={isTyping}
          />
          <button onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="rounded-xl px-4 py-3 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: category.color }}>
            <Send size={18} color="white" />
          </button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          AI가 생성한 참고 의견입니다. 투자 판단은 본인의 책임입니다.
        </p>
      </div>
    </div>
  );
}
