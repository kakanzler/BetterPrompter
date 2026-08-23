import type { Metadata } from "next";
import { Sawarabi_Gothic } from "next/font/google";
import "./globals.css";

/**
 * さわらびゴシック。日本語サブセットは大きいので事前読み込みはしない
 * （unicode-range で必要な範囲だけが取得される）。
 */
const sawarabi = Sawarabi_Gothic({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-sawarabi",
});

export const metadata: Metadata = {
  title: "BetterPrompter",
  description:
    "Instruction と example を入力するだけで、XML タグで構造化された Prompt Engineering 済みのプロンプトを生成します。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={sawarabi.variable}>
      <body>{children}</body>
    </html>
  );
}
