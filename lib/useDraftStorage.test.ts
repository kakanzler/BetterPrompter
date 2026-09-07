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
  });

  it("欠けている新キーを既定値で埋める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.draft.role).toBe("");
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

describe("styleTokens の正規化", () => {
  it("キーを持たない旧下書きは既定値で埋める", () => {
    const restored = normalizeDraft(LEGACY_DRAFT);
    expect(restored?.draft.styleTokens).toEqual([]);
    expect(restored?.draft.styleTagName).toBe("style_tokens");
    expect(restored?.draft.styleOutputMode).toBe("customProperties");
  });

  it("配列でなければ空配列に落とす", () => {
    expect(normalizeDraft({ styleTokens: "配列ではない" })?.draft.styleTokens).toEqual([]);
  });

  it("空白だけのタグ名は既定へ、知らない出力モードは customProperties へ", () => {
    const restored = normalizeDraft({ styleTagName: "   ", styleOutputMode: "inline" });
    expect(restored?.draft.styleTagName).toBe("style_tokens");
    expect(restored?.draft.styleOutputMode).toBe("customProperties");
  });

  it("既知の値はそのまま通す", () => {
    const restored = normalizeDraft({ styleTagName: "design_tokens", styleOutputMode: "declarations" });
    expect(restored?.draft.styleTagName).toBe("design_tokens");
    expect(restored?.draft.styleOutputMode).toBe("declarations");
  });

  it("知らない type と apply は既定へ落とす", () => {
    const restored = normalizeDraft({
      styleTokens: [{ id: "s", name: "brand", type: "conic", apply: "fill" }],
    });
    expect(restored?.draft.styleTokens[0].type).toBe("solid");
    expect(restored?.draft.styleTokens[0].apply).toBe("background");
    expect(restored?.draft.styleTokens[0].value).toEqual({ color: { r: 0, g: 0, b: 0, a: 1 } });
  });

  it("範囲外の角度・位置・色をクランプする", () => {
    const restored = normalizeDraft({
      styleTokens: [
        {
          id: "s",
          name: "brand",
          type: "linear",
          value: {
            angle: 720,
            stops: [
              { id: "a", position: -10, color: { r: 999, g: 87, b: 51, a: 1 } },
              { id: "b", position: 500, color: { r: 51, g: 193, b: 255, a: 3 } },
            ],
          },
        },
      ],
    });
    const value = restored?.draft.styleTokens[0].value as { angle: number; stops: unknown[] };
    expect(value.angle).toBe(360);
    expect(value.stops).toEqual([
      { id: "a", position: 0, color: { r: 255, g: 87, b: 51, a: 1 } },
      { id: "b", position: 100, color: { r: 51, g: 193, b: 255, a: 1 } },
    ]);
  });

  it("停止点が1点しか無ければ2点に補う", () => {
    const restored = normalizeDraft({
      styleTokens: [
        {
          id: "s",
          name: "brand",
          type: "linear",
          value: { stops: [{ id: "a", position: 30, color: { r: 51, g: 193, b: 255, a: 1 } }] },
        },
      ],
    });
    const value = restored?.draft.styleTokens[0].value as {
      angle: number;
      stops: Array<{ id: string; position: number }>;
    };
    // 角度が壊れていれば既定の 90 度。
    expect(value.angle).toBe(90);
    expect(value.stops).toHaveLength(2);
    expect(value.stops[1]).toEqual({
      id: "s-stop-1",
      position: 100,
      color: { r: 51, g: 193, b: 255, a: 1 },
    });
  });

  it("radial は形を circle / ellipse に丸め、停止点を揃える", () => {
    const restored = normalizeDraft({
      styleTokens: [{ id: "s", name: "brand", type: "radial", value: { shape: "square" } }],
    });
    const value = restored?.draft.styleTokens[0].value as { shape: string; stops: unknown[] };
    expect(value.shape).toBe("circle");
    expect(value.stops).toHaveLength(2);
  });

  it("id が無ければ添字から補う", () => {
    const restored = normalizeDraft({ styleTokens: [{ name: "brand" }, { name: "accent" }] });
    expect(restored?.draft.styleTokens.map((token) => token.id)).toEqual(["style-0", "style-1"]);
  });

  it("空の description はキーごと持たない", () => {
    const restored = normalizeDraft({
      styleTokens: [{ id: "s", name: "brand", description: "  " }, { id: "t", description: " 主要色 " }],
    });
    expect(restored?.draft.styleTokens[0]).not.toHaveProperty("description");
    expect(restored?.draft.styleTokens[1].description).toBe("主要色");
  });

  it("自分の出力を再正規化しても変わらない（冪等）", () => {
    const messy = {
      styleTokens: [
        { name: "brand", type: "conic", apply: "fill", description: " 主要色 " },
        {
          id: "g",
          name: "hero",
          type: "linear",
          value: { angle: 720, stops: [{ position: -10, color: { r: 999 } }] },
        },
      ],
    };
    const once = normalizeDraft(messy)!.draft;
    const twice = normalizeDraft(once)!.draft;
    expect(twice.styleTokens).toEqual(once.styleTokens);
  });

  it("保存済みの styleTokens カードは生き残る", () => {
    const restored = normalizeDraft({
      instruction: "要約する",
      sections: [
        { id: "instruction", kind: "instruction" },
        { id: "styleTokens", kind: "styleTokens" },
      ],
    });
    expect(restored?.draft.sections.map((s) => s.kind)).toEqual(["instruction", "styleTokens"]);
  });
});

describe("sections への移行", () => {
  /** 旧仕様の並びは documents → 指示まわり → custom(before) → examples → custom(after) → 実入力。 */
  const OLD_FULL = {
    role: "編集者",
    instruction: "要約する",
    constraints: ["200字以内"],
    documents: [{ id: "d", source: "a.md", content: "資料" }],
    examples: [{ id: "e", input: "本文", thinking: "", idealOutput: "要約" }],
    customSections: [
      { id: "ctx", tag: "context", content: "背景", children: [], placement: "before" },
      { id: "fmt", tag: "output_format", content: "箇条書き", children: [], placement: "after" },
    ],
    outputSchema: '{"type":"object"}',
    includeRealInput: true,
  };

  const kinds = (value: unknown) =>
    normalizeDraft(value)?.draft.sections.map((s) => `${s.kind}:${s.id}`);

  it("旧仕様と同じ並びを組み立てる", () => {
    expect(kinds(OLD_FULL)).toEqual([
      "role:role",
      "documents:documents",
      "instruction:instruction",
      "constraints:constraints",
      "custom:ctx",
      "examples:examples",
      "custom:fmt",
      "outputSchema:outputSchema",
      "realInput:realInput",
    ]);
  });

  it("longContextMode が true なら指示まわりが examples の後ろへ回る", () => {
    const result = kinds({ ...OLD_FULL, longContextMode: true })!;
    expect(result.indexOf("examples:examples")).toBeLessThan(result.indexOf("instruction:instruction"));
    expect(result.indexOf("examples:examples")).toBeLessThan(result.indexOf("constraints:constraints"));
    // ドキュメントは先頭のまま。
    expect(result.indexOf("documents:documents")).toBeLessThan(result.indexOf("examples:examples"));
  });

  it("includeRealInput が false なら実入力の枠を作らない", () => {
    expect(kinds({ ...OLD_FULL, includeRealInput: false })).not.toContain("realInput:realInput");
  });

  it("中身の無いセクションはカードを作らない", () => {
    expect(kinds({ instruction: "要約する" })).toEqual([
      "role:role",
      "instruction:instruction",
      "realInput:realInput",
    ]);
  });

  it("保存済みの sections はそのまま尊重する", () => {
    const saved = {
      ...OLD_FULL,
      sections: [
        { id: "examples", kind: "examples" },
        { id: "instruction", kind: "instruction" },
      ],
    };
    expect(kinds(saved)).toEqual(["examples:examples", "instruction:instruction"]);
  });

  it("知らない kind と、対応ノードが無い custom は捨てる", () => {
    const saved = {
      ...OLD_FULL,
      sections: [
        { id: "instruction", kind: "instruction" },
        { id: "bogus", kind: "bogus" },
        { id: "missing-node", kind: "custom" },
      ],
    };
    expect(kinds(saved)).toEqual(["instruction:instruction"]);
  });
});
