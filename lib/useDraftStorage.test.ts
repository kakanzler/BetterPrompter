import { describe, expect, it } from "vitest";
import { normalizeDraft } from "./useDraftStorage";

/** Phase A/B のキーを一切持たない、旧バージョンが書き出した下書き。 */
const LEGACY_DRAFT = {
  instruction: "記事を3行で要約してください。",
  examples: [{ id: "default", input: "本文A", thinking: "", idealOutput: "・要点A" }],
  customSections: [{ id: "s", tag: "context", content: "背景", children: [], placement: "before" }],
  includeRealInput: true,
};

describe("normalizeDraft の後方互換", () => {
  it("旧形式の下書きを読める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.instruction).toBe("記事を3行で要約してください。");
    expect(restored?.examples).toHaveLength(1);
    expect(restored?.customSections[0].tag).toBe("context");
    expect(restored?.includeRealInput).toBe(true);
  });

  it("欠けている新キーを既定値で埋める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.role).toBe("");
    expect(restored?.prefill).toBe("");
    expect(restored?.chainOfThought).toBe(false);
    expect(restored?.longContextMode).toBe(false);
    expect(restored?.constraints).toEqual([]);
    expect(restored?.documents).toEqual([]);
    expect(restored?.variableValues).toEqual({});
  });

  it("kind を持たない example は良い例になる", () => {
    expect(normalizeDraft(LEGACY_DRAFT)?.examples[0].kind).toBe("positive");
  });

  it("example が0件でも空画面にならないよう1件残す", () => {
    expect(normalizeDraft({ examples: [] })?.examples).toHaveLength(1);
  });
});

describe("normalizeDraft の防御", () => {
  it("オブジェクトでなければ null", () => {
    expect(normalizeDraft("文字列")).toBeNull();
    expect(normalizeDraft(null)).toBeNull();
    expect(normalizeDraft(42)).toBeNull();
  });

  it("型の違う値は既定値に落とす", () => {
    const restored = normalizeDraft({
      instruction: 42,
      constraints: "配列ではない",
      documents: { not: "an array" },
      variableValues: { OK: "値", NG: 1 },
    });
    expect(restored?.instruction).toBe("");
    expect(restored?.constraints).toEqual([]);
    expect(restored?.documents).toEqual([]);
    expect(restored?.variableValues).toEqual({ OK: "値" });
  });

  it("深すぎるネストは打ち切る", () => {
    let node: unknown = { tag: "deep", content: "底", children: [] };
    for (let i = 0; i < 30; i += 1) node = { tag: "n", content: "", children: [node] };
    const restored = normalizeDraft({ customSections: [node] });

    let depth = 0;
    let cursor = restored?.customSections[0];
    while (cursor && cursor.children.length > 0) {
      cursor = cursor.children[0];
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(21);
  });
});
