import { describe, expect, it } from "vitest";
import { normalizeDraft } from "./useDraftStorage";

/** Phase A/B のキーを一切持たない、初期バージョンが書き出した下書き。 */
const LEGACY_DRAFT = {
  instruction: "記事を3行で要約してください。",
  examples: [{ id: "default", input: "本文A", thinking: "", idealOutput: "・要点A" }],
  customSections: [{ id: "s", tag: "context", content: "背景", children: [], placement: "before" }],
  includeRealInput: true,
};

/** prefill を持っていた頃（Phase A/B）の下書き。 */
const PREFILL_DRAFT = {
  ...LEGACY_DRAFT,
  role: "あなたは編集者です。",
  prefill: "<analysis>",
};

describe("normalizeDraft の後方互換", () => {
  it("初期形式の下書きを読める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.draft.instruction).toBe("記事を3行で要約してください。");
    expect(restored?.draft.examples).toHaveLength(1);
    expect(restored?.draft.customSections[0].tag).toBe("context");
    expect(restored?.draft.includeRealInput).toBe(true);
  });

  it("欠けている新キーを既定値で埋める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.draft.role).toBe("");
    expect(restored?.draft.longContextMode).toBe(false);
    expect(restored?.draft.constraints).toEqual([]);
    expect(restored?.draft.documents).toEqual([]);
    expect(restored?.draft.variableValues).toEqual({});
    expect(restored?.draft.outputSchema).toBe("");
    expect(restored?.draft.effort).toBe("");
  });

  it("kind を持たない example は良い例になる", () => {
    expect(normalizeDraft(LEGACY_DRAFT)?.draft.examples[0].kind).toBe("positive");
  });

  it("example が0件ならそのまま0件で返す（1件に戻さない）", () => {
    expect(normalizeDraft({ examples: [] })?.draft.examples).toEqual([]);
    expect(normalizeDraft({})?.draft.examples).toEqual([]);
  });

  it("thinking に中身がある旧データは欄を開いた状態で復元する", () => {
    const withThinking = normalizeDraft({
      examples: [{ id: "a", input: "本文", thinking: "要点は3つ", idealOutput: "要約" }],
    });
    expect(withThinking?.draft.examples[0].showThinking).toBe(true);
  });

  it("thinking が空なら欄は閉じたまま", () => {
    expect(normalizeDraft(LEGACY_DRAFT)?.draft.examples[0].showThinking).toBe(false);
  });
});

describe("撤去した prefill の扱い", () => {
  it("中身があれば droppedPrefill に載せ、draft には含めない", () => {
    const restored = normalizeDraft(PREFILL_DRAFT);
    expect(restored?.droppedPrefill).toBe("<analysis>");
    expect(restored?.draft).not.toHaveProperty("prefill");
    // 他のフィールドは巻き添えにしない。
    expect(restored?.draft.role).toBe("あなたは編集者です。");
  });

  it("prefill が無ければ droppedPrefill は undefined", () => {
    expect(normalizeDraft(LEGACY_DRAFT)?.droppedPrefill).toBeUndefined();
  });

  it("空白だけの prefill では通知を出さない", () => {
    expect(normalizeDraft({ ...LEGACY_DRAFT, prefill: "   \n " })?.droppedPrefill).toBeUndefined();
  });
});

describe("effort の正規化", () => {
  it("既知の値はそのまま通す", () => {
    expect(normalizeDraft({ effort: "xhigh" })?.draft.effort).toBe("xhigh");
  });

  it("知らない値は「指定しない」に落とす", () => {
    expect(normalizeDraft({ effort: "turbo" })?.draft.effort).toBe("");
    expect(normalizeDraft({ effort: 3 })?.draft.effort).toBe("");
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
    expect(restored?.draft.instruction).toBe("");
    expect(restored?.draft.constraints).toEqual([]);
    expect(restored?.draft.documents).toEqual([]);
    expect(restored?.draft.variableValues).toEqual({ OK: "値" });
  });

  it("深すぎるネストは打ち切る", () => {
    let node: unknown = { tag: "deep", content: "底", children: [] };
    for (let i = 0; i < 30; i += 1) node = { tag: "n", content: "", children: [node] };
    const restored = normalizeDraft({ customSections: [node] });

    let depth = 0;
    let cursor = restored?.draft.customSections[0];
    while (cursor && cursor.children.length > 0) {
      cursor = cursor.children[0];
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(21);
  });
});
