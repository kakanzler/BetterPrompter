"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  defaultDraft,
  type CustomNode,
  type DocumentEntry,
  type Effort,
  type Example,
  type PromptDraft,
} from "./types";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

const STORAGE_KEY = "betterprompter:draft";

/** ネストが深すぎる JSON でスタックを溢れさせないための上限。 */
const MAX_DEPTH = 20;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : [];
}

function asStringMap(value: unknown): Record<string, string> {
  const entries = Object.entries(asRecord(value)).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

function normalizeNodes(value: unknown, depth: number, path: string): CustomNode[] {
  if (!Array.isArray(value) || depth > MAX_DEPTH) return [];
  return value.map((item, index) => {
    const entry = asRecord(item);
    const id = `${path}-${index}`;
    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : id,
      tag: asString(entry.tag),
      content: asString(entry.content),
      children: normalizeNodes(entry.children, depth + 1, id),
      collapsed: entry.collapsed === true,
      placement: entry.placement === "after" ? "after" : "before",
    };
  });
}

function normalizeDocuments(value: unknown): DocumentEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const entry = asRecord(item);
    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : `document-${index}`,
      source: asString(entry.source),
      content: asString(entry.content),
      collapsed: entry.collapsed === true,
    };
  });
}

function normalizeExamples(value: unknown): Example[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const entry = asRecord(item);
    const thinking = asString(entry.thinking);
    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : `restored-${index}`,
      input: asString(entry.input),
      thinking,
      idealOutput: asString(entry.idealOutput),
      collapsed: entry.collapsed === true,
      // kind を持たない旧データは良い例として扱う。
      kind: entry.kind === "negative" ? "negative" : "positive",
      // showThinking を持たない旧データでも、中身があるなら開いた状態で復元する。
      showThinking: entry.showThinking === true || thinking.trim() !== "",
    };
  });
}

export type NormalizeResult = {
  draft: PromptDraft;
  /**
   * 撤去した Assistant prefill に中身があった場合だけ入る。
   * 黙って捨てず、呼び出し側が移行通知でユーザーに見せるために返している。
   */
  droppedPrefill?: string;
};

/**
 * 外から来た JSON（localStorage / インポートファイル）を PromptDraft に整える。
 * 形が違えば null を返し、呼び出し側は既定値のまま続行する。
 * 新しいキーを持たない古い下書きも、既定値で埋めてそのまま読めるようにしてある。
 */
export function normalizeDraft(value: unknown): NormalizeResult | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const prefill = asString(raw.prefill).trim();

  const draft: PromptDraft = {
    role: asString(raw.role),
    instruction: asString(raw.instruction),
    constraints: asStringArray(raw.constraints),
    documents: normalizeDocuments(raw.documents),
    longContextMode: raw.longContextMode === true,
    // example は使うとは限らないので0件のまま通す。
    examples: normalizeExamples(raw.examples),
    customSections: normalizeNodes(raw.customSections, 0, "section"),
    includeRealInput: raw.includeRealInput !== false,
    outputSchema: asString(raw.outputSchema),
    effort: EFFORTS.includes(raw.effort as Effort) ? (raw.effort as Effort) : "",
    variableValues: asStringMap(raw.variableValues),
  };

  return prefill ? { draft, droppedPrefill: prefill } : { draft };
}

/**
 * 下書きを localStorage に永続化する。
 * SSR と初回レンダを一致させるため、state は必ず既定値で初期化し、
 * 復元はマウント後の effect で行う。
 */
export function useDraftStorage(): [
  PromptDraft,
  Dispatch<SetStateAction<PromptDraft>>,
  string | undefined,
] {
  const [draft, setDraft] = useState<PromptDraft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);
  const [droppedPrefill, setDroppedPrefill] = useState<string | undefined>();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = normalizeDraft(JSON.parse(raw));
        if (restored) {
          setDraft(restored.draft);
          setDroppedPrefill(restored.droppedPrefill);
        }
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

  return [draft, setDraft, droppedPrefill];
}
