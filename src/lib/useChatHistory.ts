'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const STORAGE_PREFIX = 'rich-finance-chat-';

function getKey(category: string) {
  return STORAGE_PREFIX + category;
}

function readMessages(category: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getKey(category));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeMessages(category: string, messages: ChatMessage[]) {
  localStorage.setItem(getKey(category), JSON.stringify(messages));
}

export function useChatHistory(category: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMessages(readMessages(category));
    setLoaded(true);
  }, [category]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role,
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => {
      const next = [...prev, msg];
      writeMessages(category, next);
      return next;
    });
    return msg;
  }, [category]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    writeMessages(category, []);
  }, [category]);

  return { messages, addMessage, clearHistory, loaded };
}
