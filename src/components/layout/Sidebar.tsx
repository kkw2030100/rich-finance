'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, TrendingUp, Activity, Search, MessageCircle, ChevronDown, Zap, Filter } from 'lucide-react';
import clsx from 'clsx';
import { chatCategories } from '@/data/chat-categories';

const nav = [
  { href: '/', label: '홈', icon: Home },
  { href: '/stocks', label: '종목 탐색', icon: Search },
  { href: '/screener', label: '저평가 스크리너', icon: Filter },
  { href: '/market', label: '시장 현황', icon: Activity },
  { href: '/signals', label: '특수 신호', icon: Zap },
];

export function Sidebar() {
  const pathname = usePathname();
  const isChatActive = pathname.startsWith('/chat');
  const [chatOpen, setChatOpen] = useState(isChatActive);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
          <BarChart3 size={18} color="white" />
        </div>
        <div>
          <div className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
            RICH FINANCE
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            AI 주식 분석
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors',
                active ? 'font-semibold' : 'font-normal',
              )}
              style={{
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? '#6ea8fe' : 'var(--text-secondary)',
              }}>
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        {/* AI Chat - Collapsible */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors w-full cursor-pointer',
            isChatActive ? 'font-semibold' : 'font-normal',
          )}
          style={{
            background: isChatActive ? 'rgba(59,130,246,0.12)' : 'transparent',
            color: isChatActive ? '#6ea8fe' : 'var(--text-secondary)',
          }}>
          <MessageCircle size={18} />
          <span className="flex-1 text-left">AI 상담</span>
          <ChevronDown
            size={14}
            className="transition-transform"
            style={{ transform: chatOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* Chat Sub-menu */}
        {chatOpen && (
          <div className="ml-3 pl-3 mb-1" style={{ borderLeft: '1px solid var(--border)' }}>
            {chatCategories.map(cat => {
              const href = `/chat/${cat.id}`;
              const active = pathname === href;
              return (
                <Link key={cat.id} href={href}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors',
                    active ? 'font-semibold' : 'font-normal',
                  )}
                  style={{
                    background: active ? `${cat.color}15` : 'transparent',
                    color: active ? cat.color : 'var(--text-secondary)',
                  }}>
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="truncate">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 text-[10px]" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={12} />
          <span>시장 위험도</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full score-bar"
              style={{ width: '29%', background: 'var(--accent-yellow)' }} />
          </div>
          <span style={{ color: 'var(--accent-yellow)' }}>29</span>
        </div>
        <div className="mt-1" style={{ color: 'var(--accent-yellow)' }}>보통 — 선별 접근</div>
      </div>
    </aside>
  );
}
