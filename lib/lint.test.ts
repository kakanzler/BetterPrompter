import { describe, expect, it } from "vitest";
import { lintDraft } from "./lint";
import { defaultDraft, emptyExample } from "./types";
import type { PromptDraft } from "./types";

function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  return { ...defaultDraft(), includeRealInput: false, ...overrides };
}

function ids(overrides: Partial<PromptDraft> = {}): string[] {
  return lintDraft(draft(overrides)).map((finding) => finding.id);
}

/** 対象ルール以外を黙らせた、指摘の出ない土台。 */
function clean(overrides: Partial<PromptDraft> = {}): Partial<PromptDraft> {
  return {
    instruction: "記事を3行で要約してください。",
    constraints: ["200字以内"],
    examples: [
      { ...emptyExample("a"), input: "本文A", idealOutput: "要約A" },
      { ...emptyExample("b"), input: "本文B", idealOutput: "要約B" },
      { ...emptyExample("c"), input: "本文C", idealOutput: "要約C" },
    ],
    ...overrides,
  };
}

describe("lintDraft", () => {
  it("整った下書きなら指摘が出ない", () => {
    expect(ids(clean())).toEqual([]);
  });

  it("書き始めたのに指示が空なら warn する", () => {
    const findings = lintDraft(draft({ role: "あなたは編集者です。" }));
    const target = findings.find((f) => f.id === "no-instruction");
    expect(target?.severity).toBe("warn");
  });

  it("指示が空なら vague は重ねて出さない", () => {
    const found = ids({ role: "あなたは編集者です。" });
    expect(found).toContain("no-instruction");
    expect(found).not.toContain("vague-instruction");
  });

  it("指示が短すぎると info を出す", () => {
    expect(ids(clean({ instruction: "要約して" }))).toContain("vague-instruction");
  });

  it("example が1〜2件なら few-examples", () => {
    expect(ids(clean({ examples: [{ ...emptyExample("a"), input: "本文" }] }))).toContain(
      "few-examples",
    );
  });

  it("中身のない example は数に入れない", () => {
    expect(ids(clean({ examples: [emptyExample("a")] }))).toContain("no-examples");
  });

  it("悪い例だけでは良い例の不足として扱う", () => {
    const negative = { ...emptyExample("n"), kind: "negative" as const, input: "入力" };
    expect(ids(clean({ examples: [negative] }))).toContain("no-examples");
  });

  it("constraints も出力形式タグも無ければ知らせる", () => {
    expect(ids(clean({ constraints: [] }))).toContain("no-output-format");
  });

  it("<output_format> タグがあれば黙る", () => {
    const found = ids(
      clean({
        constraints: [],
        customSections: [{ id: "c", tag: "output format", content: "箇条書き", children: [] }],
      }),
    );
    expect(found).not.toContain("no-output-format");
  });

  it("長いのに long-context モードが OFF なら知らせる", () => {
    expect(ids(clean({ instruction: "あ".repeat(40_000) }))).toContain("long-context-off");
  });

  it("long-context モードが ON なら黙る", () => {
    const found = ids(clean({ instruction: "あ".repeat(40_000), longContextMode: true }));
    expect(found).not.toContain("long-context-off");
  });

  it("トップレベルのタグ名が重複したら知らせる", () => {
    const findings = lintDraft(
      draft(
        clean({
          customSections: [
            { id: "1", tag: "context", content: "A", children: [] },
            { id: "2", tag: "context", content: "B", children: [] },
          ],
        }),
      ),
    );
    const target = findings.find((f) => f.id === "duplicate-tag");
    expect(target?.message).toContain("<context>");
  });

  it("テスト値が未設定の変数を知らせる", () => {
    const findings = lintDraft(draft(clean({ instruction: "{{TOPIC}} について3行で書いてください。" })));
    const target = findings.find((f) => f.id === "unset-variable");
    expect(target?.message).toContain("{{TOPIC}}");
  });

  it("テスト値が入っていれば黙る", () => {
    const found = ids(
      clean({
        instruction: "{{TOPIC}} について3行で書いてください。",
        variableValues: { TOPIC: "気候変動" },
      }),
    );
    expect(found).not.toContain("unset-variable");
  });
});

describe("unset-variable の INPUT 除外", () => {
  it("実入力の枠だけでは警告しない", () => {
    const findings = lintDraft({
      ...defaultDraft(),
      instruction: "記事を3行で要約してください。",
      constraints: ["200字以内"],
      examples: [
        { ...emptyExample("a"), input: "本文A", idealOutput: "要約A" },
        { ...emptyExample("b"), input: "本文B", idealOutput: "要約B" },
        { ...emptyExample("c"), input: "本文C", idealOutput: "要約C" },
      ],
      includeRealInput: true,
    });
    expect(findings.map((f) => f.id)).not.toContain("unset-variable");
  });

  it("INPUT 以外の変数なら警告する", () => {
    const findings = lintDraft({
      ...defaultDraft(),
      instruction: "{{TOPIC}} について3行で要約してください。",
      constraints: ["200字以内"],
      examples: [
        { ...emptyExample("a"), input: "本文A", idealOutput: "要約A" },
        { ...emptyExample("b"), input: "本文B", idealOutput: "要約B" },
        { ...emptyExample("c"), input: "本文C", idealOutput: "要約C" },
      ],
      includeRealInput: true,
    });
    const target = findings.find((f) => f.id === "unset-variable");
    expect(target?.message).toBe("テスト値が未設定の変数があります: {{TOPIC}}");
  });
});

describe("現行 Claude 向けのルール", () => {
  it("CoT を勧める古いルールはもう出ない", () => {
    const withThinking = clean();
    withThinking.examples![0].thinking = "要点は3つ";
    expect(ids(withThinking)).not.toContain("thinking-without-cot");
  });

  it("prefill のルールはもう出ない", () => {
    expect(ids(clean())).not.toContain("prefill-trailing-space");
    expect(ids()).not.toContain("prefill-trailing-space");
  });

  it("壊れた Output schema は warn", () => {
    const findings = lintDraft(draft(clean({ outputSchema: "{ 壊れている" })));
    const target = findings.find((f) => f.id === "invalid-output-schema");
    expect(target?.severity).toBe("warn");
  });

  it("正しい Output schema があれば出力形式の指摘が消える", () => {
    const found = ids(clean({ constraints: [], outputSchema: '{"type":"object"}' }));
    expect(found).not.toContain("no-output-format");
    expect(found).not.toContain("invalid-output-schema");
  });

  it("壊れた Output schema では出力形式の指摘も残る", () => {
    const found = ids(clean({ constraints: [], outputSchema: "{ 壊れている" }));
    expect(found).toContain("no-output-format");
  });
});

describe("出しすぎない Lint", () => {
  it("白紙の下書きでは何も出さない", () => {
    expect(lintDraft(defaultDraft())).toEqual([]);
  });

  it("Instruction が空のうちは example を急かさない", () => {
    // Role だけ書き始めた段階。白紙ではないが example の話をする段ではない。
    expect(ids({ role: "あなたは編集者です。" })).not.toContain("no-examples");
  });

  it("Instruction を書いてから example の不足を info で知らせる", () => {
    const findings = lintDraft(draft({ instruction: "記事を3行で要約してください。" }));
    const target = findings.find((f) => f.id === "no-examples");
    expect(target?.severity).toBe("info");
  });

  it("example 0件を要対応（warn）にはしない", () => {
    const warns = lintDraft(draft({ instruction: "記事を3行で要約してください。" }))
      .filter((f) => f.severity === "warn")
      .map((f) => f.id);
    expect(warns).not.toContain("no-examples");
  });

  it("撤去したルールはどの入力でも出ない", () => {
    for (const found of [ids(), ids(clean()), ids({ role: "編集者" })]) {
      expect(found).not.toContain("cot-not-needed");
      expect(found).not.toContain("example-thinking-redundant");
      expect(found).not.toContain("prefill-trailing-space");
      expect(found).not.toContain("thinking-without-cot");
    }
  });
});
