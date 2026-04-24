'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatCategory } from '@/data/chat-categories';
import { useChatHistory } from '@/lib/useChatHistory';

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

    try {
      // Build conversation history for API
      const chatMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: category.id, messages: chatMessages }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '응답 실패');
      }

      const data = await res.json();
      addMessage('assistant', data.content);
    } catch (err) {
      addMessage('assistant', `죄송합니다. 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (${err instanceof Error ? err.message : '알 수 없는 오류'})`);
    } finally {
      setIsTyping(false);
    }
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
                    {msg.role === 'assistant' ? (
                      <div className="chat-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
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
