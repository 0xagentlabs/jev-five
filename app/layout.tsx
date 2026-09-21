import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev Five — System One 五子棋",
  description: "让 TypeSafe Jev 驱动每一步决策的五子棋实验场。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
