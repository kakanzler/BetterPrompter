"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { defaultDraft, type Example, type PromptDraft } from "./types";

const STORAGE_KEY = "betterprompter:draft";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 外から来た JSON（localStorage / インポートファイル）を PromptDraft に整える。
 * 形が違えば null を返し、呼び出し側は既定値のまま続行する。
 */
export function normalizeDraft(value: unknown): PromptDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const examples: Example[] = Array.isArray(raw.examples)
    ? raw.examples.map((item, index) => {
        const entry = (typeof item === "object" && item !== null ? item : {}) as Record<
          string,
          unknown
        >;
        return {
          id: typeof entry.id === "string" && entry.id ? entry.id : `restored-${index}`,
          input: asString(entry.input),
          thinking: asString(entry.thinking),
          idealOutput: asString(entry.idealOutput),
          collapsed: entry.collapsed === true,
        };
      })
    : [];

  return {
    instruction: asString(raw.instruction),
    // Example が0件だと追加ボタンしかない空画面になるため、必ず1件は残す。
    examples: examples.length > 0 ? examples : defaultDraft().examples,
    includeRealInput: raw.includeRealInput !== false,
  };
}

/**
 * 下書きを localStorage に永続化する。
 * SSR と初回レンダを一致させるため、state は必ず既定値で初期化し、
 * 復元はマウント後の effect で行う。
 */
export function useDraftStorage(): [
  PromptDraft,
  Dispatch<SetStateAction<PromptDraft>>,
  boolean,
] {
  const [draft, setDraft] = useState<PromptDraft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = normalizeDraft(JSON.parse(raw));
        if (restored) setDraft(restored);
      }
    } catch {
      // 壊れた保存データは捨てて既定値で始める。
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // 復元が終わる前に走らせると、既定値で保存済みデータを潰してしまう。
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 容量超過やプライベートモードでは保存を諦める。
    }
  }, [draft, hydrated]);

  return [draft, setDraft, hydrated];
}
