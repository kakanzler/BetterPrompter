"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import { countText, hasTagCollision } from "@/lib/buildPrompt";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  variant?: "plain" | "onCard";
};

export default function AutoTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  variant = "plain",
}: Props) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  // 入力量に合わせて高さを追従させる。先に auto に戻さないと縮まない。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // 横幅が変わると折り返し行数も変わるため、リサイズでも測り直す。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const collision = hasTagCollision(value);
  const { chars, words } = useMemo(() => countText(value), [value]);

  return (
    <div className="field">
      <div className="field-head">
        {label ? (
          <label className={variant === "onCard" ? "tag-label" : "section-label"} htmlFor={id}>
            {label}
          </label>
        ) : (
          <span />
        )}
        <span className="field-meta">
          {collision && (
            <span className="warn" role="status">
              ⚠ 閉じタグが含まれています — 生成結果の構造が壊れます
            </span>
          )}
          {chars > 0 && (
            <span className="counter">
              {chars.toLocaleString()} 文字
              {words !== null && ` / ${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}
            </span>
          )}
        </span>
      </div>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
