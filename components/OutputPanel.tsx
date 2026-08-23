"use client";

import { useEffect, useMemo, useState } from "react";
import { countText, estimateTokens } from "@/lib/buildPrompt";

type Props = {
  prompt: string;
};

export default function OutputPanel({ prompt }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const stats = useMemo(() => {
    const { chars, words } = countText(prompt);
    return { chars, words, tokens: estimateTokens(prompt) };
  }, [prompt]);

  async function handleCopy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // clipboard API が使えない環境（非 HTTPS など）向けのフォールバック。
      const area = document.createElement("textarea");
      area.value = prompt;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
    }
  }

  return (
    <>
      <div className="section-head">
        <h2 className="section-label">Prompt</h2>
        <div className="section-head-actions">
          {prompt && (
            <span className="stats">
              {stats.chars.toLocaleString()} 文字
              {stats.words !== null && ` / ${stats.words.toLocaleString()} ${stats.words === 1 ? "word" : "words"}`}
              {` / 概算 ${stats.tokens.toLocaleString()} トークン`}
            </span>
          )}
          <button
            type="button"
            className="text-button"
            onClick={handleCopy}
            disabled={!prompt}
            aria-label="生成されたプロンプトをコピー"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <output className="output" aria-live="polite">
        {prompt ? prompt : <span className="output-placeholder">OUTPUT HERE</span>}
      </output>
    </>
  );
}
