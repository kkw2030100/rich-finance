'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, TrendingUp, Activity, Search, MessageCircle, ChevronDown, Zap, Briefcase, LogIn, LogOut, X, Map } from 'lucide-react';
import clsx from 'clsx';
import { chatCategories } from '@/data/chat-categories';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSellAlerts } from '@/lib/useSellAlerts';

const nav = [
  { href: '/', label: '홈', icon: Home },
  { href: '/screener', label: '투자 종목 발굴', icon: Search },
  { href: '/map', label: '투자 지도', icon: Map },
  { href: '/portfolio', label: '내 포트폴리오', icon: Briefcase },
  { href: '/market', label: '시장 현황', icon: Activity },
  { href: '/signals', label: '특수 신호', icon: Zap },
];

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const pathname = usePathname();
  const isChatActive = pathname.startsWith('/chat');
  const [chatOpen, setChatOpen] = useState(isChatActive);
  const { user, signOut } = useAuth();
  const { alertCount } = useSellAlerts();

  // 페이지 이동 시 모바일 드로어 자동 닫기
  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* 모바일: 백드롭 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onCloseMobile} />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 bottom-0 w-[220px] flex flex-col z-50 transition-transform',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
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
          {/* 모바일 닫기 버튼 */}
          <button onClick={onCloseMobile} className="md:hidden p-1 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 mt-2 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            const showAlert = href === '/portfolio' && alertCount > 0;
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
                <span className="flex-1">{label}</span>
                {showAlert && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-yellow)', color: '#1a1a1a' }}
                    title={`추격 위험 단계 진입한 보유 종목 ${alertCount}개`}>
                    🚨 {alertCount}
                  </span>
                )}
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

        {/* User / Auth */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          {user ? (
            <div className="flex items-center justify-between px-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                  {user.user_metadata?.name || user.email}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
              <button onClick={() => signOut()} title="로그아웃"
                className="p-1.5 rounded cursor-pointer"
                style={{ color: 'var(--text-muted)' }}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link href="/login"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#6ea8fe' }}>
              <LogIn size={14} /> 로그인
            </Link>
          )}
        </div>

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
    </>
  );
}
