import { describe, expect, it } from "vitest";
import { buildPrompt, countText, estimateTokens, hasTagCollision, sanitizeTag } from "./buildPrompt";
import { defaultDraft, emptyExample } from "./types";
import type { CustomNode, PromptDraft } from "./types";

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

describe("カスタムタグのセクション", () => {
  function node(tag: string, content = "", children: CustomNode[] = [], placement?: "before" | "after"): CustomNode {
    return { id: tag, tag, content, children, placement };
  }

  it("タグ名が空のノードは出力しない", () => {
    expect(buildPrompt(draft({ customSections: [node("", "本文")] }))).toBe("");
  });

  it("本文も子も空のノードは出力しない", () => {
    expect(buildPrompt(draft({ customSections: [node("context")] }))).toBe("");
  });

  it("本文をタグで包む", () => {
    expect(buildPrompt(draft({ customSections: [node("context", "背景") ] }))).toBe(
      "<context>\n  背景\n</context>",
    );
  });

  it("子ノードをインデントしてネストする", () => {
    const tree = node("context", "", [node("project", "", [node("name", "BetterPrompter")])]);
    expect(buildPrompt(draft({ customSections: [tree] }))).toBe(
      "<context>\n  <project>\n    <name>\n      BetterPrompter\n    </name>\n  </project>\n</context>",
    );
  });

  it("本文と子ノードを両方持てる", () => {
    const tree = node("context", "前置き", [node("note", "補足")]);
    expect(buildPrompt(draft({ customSections: [tree] }))).toBe(
      "<context>\n  前置き\n  <note>\n    補足\n  </note>\n</context>",
    );
  });

  it("中身が空の子は落ちるが、中身のある子は残る", () => {
    const tree = node("context", "", [node("empty"), node("note", "補足")]);
    expect(buildPrompt(draft({ customSections: [tree] }))).toContain("<note>");
    expect(buildPrompt(draft({ customSections: [tree] }))).not.toContain("<empty>");
  });

  it("placement で examples の前後に振り分ける", () => {
    const result = buildPrompt(
      draft({
        instruction: "要約する",
        examples: [{ ...emptyExample("a"), input: "本文" }],
        customSections: [
          node("output_format", "箇条書き", [], "after"),
          node("context", "背景", [], "before"),
        ],
      }),
    );
    expect(result.indexOf("<context>")).toBeLessThan(result.indexOf("<examples>"));
    expect(result.indexOf("<examples>")).toBeLessThan(result.indexOf("<output_format>"));
    expect(result.indexOf("<instructions>")).toBeLessThan(result.indexOf("<context>"));
  });

  it("placement 未指定は before として扱う", () => {
    const result = buildPrompt(
      draft({ examples: [{ ...emptyExample("a"), input: "本文" }], customSections: [node("context", "背景")] }),
    );
    expect(result.indexOf("<context>")).toBeLessThan(result.indexOf("<examples>"));
  });

  it("カスタムセクションだけでも実入力の枠が付く", () => {
    const result = buildPrompt(
      draft({ customSections: [node("context", "背景")], includeRealInput: true }),
    );
    expect(result.endsWith("<input>\n{{INPUT}}\n</input>")).toBe(true);
  });
});

describe("sanitizeTag", () => {
  it("空白をアンダースコアに潰す", () => {
    expect(sanitizeTag("output format")).toBe("output_format");
  });

  it("タグ構造を壊す文字を落とす", () => {
    expect(sanitizeTag("<con/text>")).toBe("context");
  });

  it("数字始まりには先頭に _ を補う", () => {
    expect(sanitizeTag("1st")).toBe("_1st");
  });

  it("日本語は残す", () => {
    expect(sanitizeTag("背景")).toBe("背景");
  });

  it("使える文字が無ければ空文字列", () => {
    expect(sanitizeTag("///")).toBe("");
    expect(sanitizeTag("   ")).toBe("");
  });
});

describe("countText", () => {
  it("空文字列は0文字・単語数なし", () => {
    expect(countText("")).toEqual({ chars: 0, words: null });
  });

  it("英文は単語数も返す", () => {
    expect(countText("Summarize the article in three lines.")).toEqual({ chars: 37, words: 6 });
  });

  it("日本語は単語数を返さない", () => {
    expect(countText("記事を3行で要約してください。").words).toBeNull();
  });

  it("記号だけなら単語数を返さない", () => {
    expect(countText("--- !!! ---").words).toBeNull();
  });
});

describe("countText の英語判定", () => {
  it("日本語が混ざっていれば単語数を返さない", () => {
    expect(countText("BetterPrompter という Next.js アプリ").words).toBeNull();
  });

  it("ASCII だけなら単語数を返す", () => {
    expect(countText("BetterPrompter is a Next.js app").words).toBe(5); // Next.js は1語
  });

  it("1語のときも数える", () => {
    expect(countText("BetterPrompter").words).toBe(1);
  });
});
