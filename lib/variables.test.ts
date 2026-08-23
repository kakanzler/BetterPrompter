import { describe, expect, it } from "vitest";
import { applyVariables, extractVariables } from "./variables";
import { defaultDraft, emptyDocument, emptyExample } from "./types";
import type { PromptDraft } from "./types";

function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  return { ...defaultDraft(), includeRealInput: false, ...overrides };
}

describe("extractVariables", () => {
  it("何も無ければ空配列", () => {
    expect(extractVariables(draft())).toEqual([]);
  });

  it("各フィールドから集める", () => {
    const found = extractVariables(
      draft({
        role: "あなたは{{ROLE}}です",
        instruction: "{{TOPIC}} について書く",
        outputSchema: '{"title":"{{TAG}}"}',
        constraints: ["{{LIMIT}}字以内"],
        documents: [{ ...emptyDocument("d"), source: "{{SRC}}", content: "{{BODY}}" }],
        examples: [{ ...emptyExample("e"), input: "{{IN}}", thinking: "{{TH}}", idealOutput: "{{OUT}}" }],
        customSections: [
          {
            id: "c",
            tag: "context",
            content: "{{CTX}}",
            children: [{ id: "c2", tag: "note", content: "{{NESTED}}", children: [] }],
          },
        ],
      }),
    );
    expect(found).toEqual([
      "ROLE",
      "TOPIC",
      "TAG",
      "LIMIT",
      "SRC",
      "BODY",
      "IN",
      "TH",
      "OUT",
      "CTX",
      "NESTED",
    ]);
  });

  it("重複は1つにまとめ、出現順を保つ", () => {
    expect(
      extractVariables(draft({ instruction: "{{B}} と {{A}} と {{B}}" })),
    ).toEqual(["B", "A"]);
  });

  it("実入力の枠が ON なら INPUT を含める", () => {
    expect(extractVariables(draft({ includeRealInput: true }))).toEqual(["INPUT"]);
  });

  it("英数字とアンダースコア以外は変数として拾わない", () => {
    expect(extractVariables(draft({ instruction: "{{ダメ}} {{ok_1}} {{a-b}}" }))).toEqual(["ok_1"]);
  });
});

describe("applyVariables", () => {
  it("テスト値で置き換える", () => {
    expect(applyVariables("{{A}} と {{B}}", { A: "あ", B: "い" })).toBe("あ と い");
  });

  it("同じ変数を何度でも置き換える", () => {
    expect(applyVariables("{{A}}{{A}}", { A: "x" })).toBe("xx");
  });

  it("未設定の変数はそのまま残す", () => {
    expect(applyVariables("{{A}} と {{B}}", { A: "あ" })).toBe("あ と {{B}}");
  });

  it("空文字列の値は未設定として扱う", () => {
    expect(applyVariables("{{A}}", { A: "" })).toBe("{{A}}");
  });

  it("変数が無ければそのまま返す", () => {
    expect(applyVariables("ただの文章", { A: "あ" })).toBe("ただの文章");
  });
});
