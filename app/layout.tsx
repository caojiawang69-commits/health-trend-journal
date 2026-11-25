import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生活与健康 · Daily",
  description: "记录每一餐，了解自己的生活节奏。手机与电脑共享的私人健康日记。",
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'生活与健康',statusBarStyle:'default'},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
