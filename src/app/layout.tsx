import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileShell } from "@/components/layout/MobileShell";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
          <MobileShell>{children}</MobileShell>
        </AuthProvider>
      </body>
    </html>
  );
}
