import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BetterPrompter",
  description:
    "Instruction と example を入力するだけで、XML タグで構造化された Prompt Engineering 済みのプロンプトを生成します。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
