import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/lib/auth/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RICH FINANCE — 주식 저평가 분석 AI",
  description: "순이익이 성장한 만큼 주가가 따라오지 않은 종목을 찾는다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 ml-[220px] min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <footer className="px-6 py-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                본 분석은 투자 자문이 아닌 정보 제공 목적이며, 금융투자상품에 대한 투자 권유를 하지 않습니다.
                제공 정보의 정확성을 보증하지 않으며, 투자 판단의 책임은 이용자 본인에게 있습니다.
                과거 데이터 기반 분석이며 미래 수익을 보장하지 않습니다.
              </p>
            </footer>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
