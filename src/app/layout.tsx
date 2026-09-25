import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Flow",
  description: "일정, 할 일, 운동, 가계부를 한곳에서 관리하는 개인 PWA",
  applicationName: "Life Flow"
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#17181b" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
