'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, BarChart3 } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function MobileShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <main className="flex-1 min-w-0 md:ml-[220px] min-h-screen flex flex-col">
        {/* 모바일 전용 상단바 (햄버거 + 로고) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setMobileOpen(true)}
            className="p-1.5 cursor-pointer"
            style={{ color: 'var(--text-primary)' }}>
            <Menu size={22} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
              <BarChart3 size={14} color="white" />
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
              RICH FINANCE
            </span>
          </Link>
          <div className="w-8" /> {/* spacer for symmetry */}
        </header>

        <div className="flex-1">{children}</div>
        <footer className="px-4 sm:px-6 py-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            본 분석은 투자 자문이 아닌 정보 제공 목적이며, 금융투자상품에 대한 투자 권유를 하지 않습니다.
            제공 정보의 정확성을 보증하지 않으며, 투자 판단의 책임은 이용자 본인에게 있습니다.
            과거 데이터 기반 분석이며 미래 수익을 보장하지 않습니다.
          </p>
        </footer>
      </main>
    </>
  );
}
