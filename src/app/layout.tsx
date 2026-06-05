import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toast } from "@heroui/react";
import { Sidebar } from "@/components/Sidebar";
import { ConfirmProvider } from "@/contexts/ConfirmContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "orange-utils - 在线开发者工具箱",
    template: "%s | orange-utils",
  },
  description:
    "免费在线开发者工具箱：HTML 可视化选择器、API 请求测试、代码对比、正则表达式测试、Markdown 编辑器。纯浏览器端运行，无需安装，数据不上传。",
  keywords: [
    "开发者工具",
    "在线工具",
    "HTML 选择器",
    "API 测试",
    "代码对比",
    "正则测试",
    "Markdown 编辑器",
    "前端工具",
    "developer tools",
  ],
  icons: {
    icon: "/logo-processed.png",
    shortcut: "/logo-processed.png",
    apple: "/logo-processed.png",
  },
  openGraph: {
    title: "orange-utils - 在线开发者工具箱",
    description:
      "免费在线开发者工具箱：HTML 选择器、API 请求、代码对比、正则测试、Markdown 编辑器。纯浏览器端运行，数据不上传。",
    siteName: "orange-utils",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex bg-background text-foreground`}
      >
        <Toast.Provider />
        <ConfirmProvider>
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
        </ConfirmProvider>
      </body>
    </html>
  );
}
