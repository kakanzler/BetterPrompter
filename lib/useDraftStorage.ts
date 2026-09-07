"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { clamp, normalizeRgba } from "./color";
import { defaultDraft, makeSection } from "./sections";
import { emptyGradientStop } from "./types";
import type {
  CustomNode,
  DocumentEntry,
  Effort,
  Example,
  GradientStop,
  PromptDraft,
  Section,
  SectionKind,
  StyleApply,
  StyleToken,
  StyleTokenType,
  StyleTokenValue,
} from "./types";

const STORAGE_KEY = "betterprompter:draft";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

const SECTION_KINDS: SectionKind[] = [
  "role",
  "instruction",
  "constraints",
  "documents",
  "examples",
  "outputSchema",
  "realInput",
  "custom",
  "styleTokens",
];

const STYLE_TOKEN_TYPES: StyleTokenType[] = ["solid", "linear", "radial"];

const STYLE_APPLIES: StyleApply[] = ["color", "background", "border-color"];

/** ネストが深すぎる JSON でスタックを溢れさせないための上限。 */
const MAX_DEPTH = 20;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** 数値として使える値だけを範囲内に収める。壊れていれば fallback。 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
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
    const id = typeof entry.id === "string" && entry.id ? entry.id : `${path}-${index}`;
    return {
      id,
      tag: asString(entry.tag),
      content: asString(entry.content),
      children: normalizeNodes(entry.children, depth + 1, id),
      collapsed: entry.collapsed === true,
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

/**
 * グラデーションの色停止点。グラデとして成立するよう必ず2点以上に揃える。
 * 足りない分は 0% / 100% に補い、色は直前の停止点から引き継ぐ。
 */
function normalizeStops(value: unknown, tokenId: string): GradientStop[] {
  const list = Array.isArray(value) ? value : [];
  const stops: GradientStop[] = list.map((item, index) => {
    const entry = asRecord(item);
    return {
      id: typeof entry.id === "string" && entry.id ? entry.id : `${tokenId}-stop-${index}`,
      color: normalizeRgba(entry.color),
      position: clampNumber(entry.position, 0, 100, 0),
    };
  });

  while (stops.length < 2) {
    const index = stops.length;
    const position = index === 0 ? 0 : 100;
    stops.push(emptyGradientStop(`${tokenId}-stop-${index}`, position, stops[index - 1]?.color));
  }

  return stops;
}

/** type に対応する形の value を組み立てる（食い違ったデータは型どおりに作り直す）。 */
function normalizeStyleValue(
  type: StyleTokenType,
  value: unknown,
  tokenId: string,
): StyleTokenValue {
  const entry = asRecord(value);
  if (type === "linear") {
    return {
      angle: clampNumber(entry.angle, 0, 360, 90),
      stops: normalizeStops(entry.stops, tokenId),
    };
  }
  if (type === "radial") {
    return {
      shape: entry.shape === "ellipse" ? "ellipse" : "circle",
      stops: normalizeStops(entry.stops, tokenId),
    };
  }
  return { color: normalizeRgba(entry.color) };
}

/** CSS スタイルトークン。自分の出力を再正規化しても変わらない（冪等）。 */
function normalizeStyleTokens(value: unknown): StyleToken[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const entry = asRecord(item);
    const id = typeof entry.id === "string" && entry.id ? entry.id : `style-${index}`;
    const type = STYLE_TOKEN_TYPES.includes(entry.type as StyleTokenType)
      ? (entry.type as StyleTokenType)
      : "solid";
    const description = asString(entry.description).trim();

    const token: StyleToken = {
      id,
      name: asString(entry.name),
      type,
      value: normalizeStyleValue(type, entry.value, id),
      apply: STYLE_APPLIES.includes(entry.apply as StyleApply)
        ? (entry.apply as StyleApply)
        : "background",
      collapsed: entry.collapsed === true,
    };
    // 空の説明はキーごと持たない（省略可能なフィールドなので往復で増やさない）。
    if (description) token.description = description;
    return token;
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

/** 保存済みの sections をそのまま読む。使えるものが無ければ null を返して合成に回す。 */
function readSections(value: unknown, nodes: CustomNode[]): Section[] | null {
  if (!Array.isArray(value)) return null;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set<string>();
  const sections: Section[] = [];

  for (const item of value) {
    const entry = asRecord(item);
    const kind = entry.kind;
    const id = entry.id;
    if (typeof kind !== "string" || typeof id !== "string" || !id) continue;
    if (!SECTION_KINDS.includes(kind as SectionKind)) continue;
    // custom カードは対応するノードが無ければ幽霊になるので落とす。
    if (kind === "custom" && !nodeIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, kind: kind as SectionKind, collapsed: entry.collapsed === true });
  }

  return sections.length > 0 ? sections : null;
}

/**
 * sections を持たない古い下書きから、**それまでと同じ出力になる並び**を組み立てる。
 * 旧仕様は「documents は常に先頭 → 指示まわり → custom(before) → examples →
 * custom(after) → 実入力」で、longContextMode が true のときだけ指示まわりが examples の後ろ。
 */
function migrateSections(raw: Record<string, unknown>, nodes: CustomNode[]): Section[] {
  const filled = (value: unknown) => Array.isArray(value) && value.length > 0;
  const rawNodes = Array.isArray(raw.customSections) ? raw.customSections : [];
  const isAfter = (index: number) => asRecord(rawNodes[index]).placement === "after";

  const before: Section[] = [];
  const after: Section[] = [];
  nodes.forEach((node, index) => {
    (isAfter(index) ? after : before).push(makeSection("custom", node.id));
  });

  const directives: Section[] = [makeSection("instruction", "instruction")];
  if (filled(raw.constraints)) directives.push(makeSection("constraints", "constraints"));

  const sections: Section[] = [makeSection("role", "role")];
  if (filled(raw.documents)) sections.push(makeSection("documents", "documents"));
  if (raw.longContextMode !== true) sections.push(...directives);
  sections.push(...before);
  if (filled(raw.examples)) sections.push(makeSection("examples", "examples"));
  if (raw.longContextMode === true) sections.push(...directives);
  sections.push(...after);
  if (asString(raw.outputSchema).trim()) sections.push(makeSection("outputSchema", "outputSchema"));
  if (raw.includeRealInput !== false) sections.push(makeSection("realInput", "realInput"));

  return sections;
}

type NormalizeResult = {
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
 */
export function normalizeDraft(value: unknown): NormalizeResult | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const prefill = asString(raw.prefill).trim();
  const customSections = normalizeNodes(raw.customSections, 0, "section");

  const draft: PromptDraft = {
    sections: readSections(raw.sections, customSections) ?? migrateSections(raw, customSections),
    role: asString(raw.role),
    instruction: asString(raw.instruction),
    constraints: asStringArray(raw.constraints),
    documents: normalizeDocuments(raw.documents),
    examples: normalizeExamples(raw.examples),
    customSections,
    outputSchema: asString(raw.outputSchema),
    effort: EFFORTS.includes(raw.effort as Effort) ? (raw.effort as Effort) : "",
    variableValues: asStringMap(raw.variableValues),
    styleTokens: normalizeStyleTokens(raw.styleTokens),
    styleTagName: asString(raw.styleTagName).trim() || "style_tokens",
    styleOutputMode: raw.styleOutputMode === "declarations" ? "declarations" : "customProperties",
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
