"use client";

import { useEffect, useMemo, useState } from "react";
import { countText, estimateTokens, flattenPrompt, type BuiltPrompt } from "@/lib/buildPrompt";

type Props = {
  built: BuiltPrompt;
};

function Stats({ text }: { text: string }) {
  const { chars, words } = countText(text);
  return (
    <span className="stats">
      {chars.toLocaleString()} 文字
      {words !== null && ` / ${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}
      {` / 概算 ${estimateTokens(text).toLocaleString()} トークン`}
    </span>
  );
}

function CopyButton({
  text,
  label,
  ariaLabel,
}: {
  text: string;
  label?: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // clipboard API が使えない環境（非 HTTPS など）向けのフォールバック。
      const area = document.createElement("textarea");
      area.value = text;
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
    <button
      type="button"
      className="text-button"
      onClick={handleCopy}
      disabled={!text}
      aria-label={ariaLabel}
    >
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}

function Turn({
  name,
  caption,
  text,
  variant = "user",
}: {
  name: string;
  caption?: string;
  text: string;
  variant?: "system" | "user" | "assistant";
}) {
  return (
    <section className="turn">
      <div className="turn-head">
        <span className={`turn-name turn-name-${variant}`}>{name}</span>
        {caption && <span className="turn-caption">{caption}</span>}
        <span className="turn-head-actions">
          <Stats text={text} />
          <CopyButton text={text} ariaLabel={`${name} をコピー`} />
        </span>
      </div>
      <output className="output">{text}</output>
    </section>
  );
}

export default function OutputPanel({ built }: Props) {
  const breakdown = useMemo(
    () =>
      built.blocks.map((block) => ({
        label: block.label,
        tokens: estimateTokens(block.text),
      })),
    [built.blocks],
  );

  const everything = useMemo(() => flattenPrompt(built), [built]);
  const isEmpty = !built.system && !built.user && !built.prefill;

  return (
    <>
      <div className="section-head">
        <h2 className="section-label">Prompt</h2>
        <div className="section-head-actions">
          <CopyButton
            text={everything}
            label="全部まとめてコピー"
            ariaLabel="System / User / Assistant を1つにまとめてコピー"
          />
        </div>
      </div>

      {isEmpty ? (
        <output className="output">
          <span className="output-placeholder">OUTPUT HERE</span>
        </output>
      ) : (
        <div className="turns">
          {built.system && <Turn name="System" text={built.system} variant="system" />}
          {built.user && <Turn name="User" text={built.user} />}
          {built.prefill && (
            <Turn
              name="Assistant"
              caption="prefill — 応答の先頭に置く"
              text={built.prefill}
              variant="assistant"
            />
          )}
        </div>
      )}

      {breakdown.length > 0 && (
        <details className="breakdown">
          <summary>セクション別トークン内訳（概算）</summary>
          <ul>
            {breakdown.map((entry, index) => (
              <li key={`${entry.label}-${index}`}>
                <code>{entry.label}</code>
                <span>{entry.tokens.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
