import { describe, expect, it } from "vitest";
import { buildPrompt, estimateTokens, hasTagCollision } from "./buildPrompt";
import { defaultDraft, emptyExample } from "./types";
import type { PromptDraft } from "./types";

function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  return { ...defaultDraft(), includeRealInput: false, ...overrides };
}

describe("buildPrompt", () => {
  it("何も入力がなければ空文字列を返す", () => {
    expect(buildPrompt(draft())).toBe("");
    expect(buildPrompt(draft({ includeRealInput: true }))).toBe("");
  });

  it("Instruction だけなら instructions ブロックだけを出す", () => {
    const result = buildPrompt(draft({ instruction: "記事を3行で要約してください。" }));
    expect(result).toBe("<instructions>\n記事を3行で要約してください。\n</instructions>");
    expect(result).not.toContain("<examples>");
  });

  it("前後の空白を trim し、タグと本文を別行にする", () => {
    expect(buildPrompt(draft({ instruction: "  \n  要約する  \n " }))).toBe(
      "<instructions>\n要約する\n</instructions>",
    );
  });

  it("空のフィールドはタグごと省略する", () => {
    const result = buildPrompt(
      draft({
        examples: [{ ...emptyExample("a"), input: "本文", idealOutput: "・要点" }],
      }),
    );
    expect(result).toContain("<input>\n本文\n</input>");
    expect(result).toContain("<ideal_output>\n・要点\n</ideal_output>");
    expect(result).not.toContain("thinking");
  });

  it("3項目すべて空の Example は出力に含めない", () => {
    const result = buildPrompt(
      draft({
        instruction: "要約する",
        examples: [emptyExample("a"), { ...emptyExample("b"), input: "本文" }],
      }),
    );
    expect(result.match(/<example>/g)).toHaveLength(1);
  });

  it("中身のある Example が0件なら examples ラッパーごと省略する", () => {
    const result = buildPrompt(draft({ instruction: "要約する", examples: [emptyExample("a")] }));
    expect(result).not.toContain("<examples>");
  });

  it("Example が2件でも examples ラッパーは1つだけ", () => {
    const result = buildPrompt(
      draft({
        examples: [
          { ...emptyExample("a"), input: "1つ目" },
          { ...emptyExample("b"), input: "2つ目" },
        ],
      }),
    );
    expect(result.match(/<examples>/g)).toHaveLength(1);
    expect(result.match(/<example>/g)).toHaveLength(2);
  });

  it("includeRealInput で末尾に実入力の枠を付ける", () => {
    const result = buildPrompt(draft({ instruction: "要約する", includeRealInput: true }));
    expect(result.endsWith("Now here is the real input.\n\n<input>\n{{INPUT}}\n</input>")).toBe(true);
  });

  it("ブロック同士は空行1つで区切る", () => {
    const result = buildPrompt(
      draft({ instruction: "要約する", examples: [{ ...emptyExample("a"), input: "本文" }] }),
    );
    expect(result).toBe(
      "<instructions>\n要約する\n</instructions>\n\n" +
        "<examples>\n<example>\n<input>\n本文\n</input>\n</example>\n</examples>",
    );
  });
});

describe("hasTagCollision", () => {
  it("閉じタグが混ざっていれば true", () => {
    expect(hasTagCollision("前 </input> 後")).toBe(true);
    expect(hasTagCollision("</ideal_output>")).toBe(true);
  });

  it("普通の文章なら false", () => {
    expect(hasTagCollision("a < b かつ c > d")).toBe(false);
    expect(hasTagCollision("<input> だけなら壊れない")).toBe(false);
  });
});

describe("estimateTokens", () => {
  it("空文字列は0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("ASCII は約4文字で1トークン", () => {
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("非 ASCII は ASCII より重く見積もる", () => {
    expect(estimateTokens("ああああ")).toBeGreaterThan(estimateTokens("aaaa"));
  });
});
