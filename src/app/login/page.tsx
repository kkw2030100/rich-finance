'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Mail, Lock, Loader2 } from 'lucide-react';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(errorParam ? '소셜 로그인에 실패했습니다. 다시 시도해주세요.' : null);

  const supabase = createClient();

  const handleSocial = async (provider: 'google' | 'kakao') => {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(`${provider} 로그인 실패: ${error.message}`);
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push(next);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('이메일을 확인해주세요. 인증 링크가 발송되었습니다.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
            style={{ background: 'rgba(59,130,246,0.15)' }}>
            <TrendingUp size={24} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>RICH FINANCE</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>한국 주식 저평가 분석 AI</p>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* 소셜 로그인 */}
          <div className="space-y-2 mb-4">
            <button onClick={() => handleSocial('kakao')} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-opacity"
              style={{ background: '#FEE500', color: '#191919', opacity: loading ? 0.6 : 1 }}>
              <span className="text-lg">💬</span> 카카오로 시작
            </button>
            <button onClick={() => handleSocial('google')} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-opacity"
              style={{ background: 'white', color: '#1f1f1f', opacity: loading ? 0.6 : 1, border: '1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google로 시작
            </button>
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>또는 이메일</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleEmail} className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="이메일"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 (6자 이상)" minLength={6}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }} />
            </div>

            {error && <div className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</div>}
            {message && <div className="text-xs" style={{ color: 'var(--accent-green)' }}>{message}</div>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--accent-blue)', color: 'white', opacity: loading ? 0.6 : 1 }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); }}
            className="w-full mt-3 text-xs cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>

        <p className="text-[10px] text-center mt-4" style={{ color: 'var(--text-muted)' }}>
          로그인 시 약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>로딩 중...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
