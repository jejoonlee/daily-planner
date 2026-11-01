import type { Metadata, Viewport } from "next";
import { ThemeRuntime } from "@/components/theme-controls";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Flow",
  description: "일정, 할 일, 운동, 가계부를 한곳에서 관리하는 개인 PWA",
  applicationName: "Life Flow"
};

export const viewport: Viewport = { themeColor: "#f7f6f2", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><ThemeRuntime />{children}</body>
    </html>
  );
}
