import { describe, expect, it } from "vitest";
import {
  buildPrompt as buildFull,
  countText,
  estimateTokens,
  flattenPrompt,
  hasTagCollision,
  sanitizeTag,
} from "./buildPrompt";
import { emptyDocument, emptyExample, emptyStyleToken } from "./types";
import { defaultDraft, makeSection } from "./sections";
import type { CustomNode, PromptDraft, Section, StyleToken } from "./types";

// 既存テストは user ターンだけを見ているので、薄いラッパで包む。
function buildPrompt(input: PromptDraft): string {
  return buildFull(input).user;
}

/**
 * 既存テストは「値を入れたセクションが出力に出る」前提で書かれているので、
 * sections を明示しない限り、中身から標準的な並びを自動で組み立てる。
 * 実入力の枠はテストごとに要否が違うため、既定では入れない。
 */
function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  const base = { ...defaultDraft(), ...overrides };
  if (overrides.sections) return base;

  const sections: Section[] = [];
  if (base.role) sections.push(makeSection("role", "role"));
  if (base.documents.length) sections.push(makeSection("documents", "documents"));
  if (base.instruction) sections.push(makeSection("instruction", "instruction"));
  if (base.constraints.length) sections.push(makeSection("constraints", "constraints"));
  if (base.styleTokens.length) sections.push(makeSection("styleTokens", "styleTokens"));
  for (const node of base.customSections) sections.push(makeSection("custom", node.id));
  if (base.examples.length) sections.push(makeSection("examples", "examples"));
  if (base.outputSchema) sections.push(makeSection("outputSchema", "outputSchema"));
  return { ...base, sections };
}

/** 末尾に実入力の枠カードを足した下書き。 */
function withRealInput(overrides: Partial<PromptDraft> = {}): PromptDraft {
  const base = draft(overrides);
  return { ...base, sections: [...base.sections, makeSection("realInput", "realInput")] };
}

describe("buildPrompt", () => {
  it("何も入力がなければ空文字列を返す", () => {
    expect(buildPrompt(draft())).toBe("");
    expect(buildPrompt(withRealInput())).toBe("");
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

  it("実入力の枠カードがあれば末尾に付く", () => {
    const result = buildPrompt(withRealInput({ instruction: "要約する" }));
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

  it("スタイルトークンの閉じタグも拾う", () => {
    expect(hasTagCollision("</style_tokens>")).toBe(true);
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
  function node(tag: string, content = "", children: CustomNode[] = []): CustomNode {
    return { id: tag, tag, content, children };
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

  it("カード順どおりに examples の前後へ置ける", () => {
    const result = buildPrompt(
      draft({
        instruction: "要約する",
        examples: [{ ...emptyExample("a"), input: "本文" }],
        customSections: [node("context", "背景"), node("output_format", "箇条書き")],
        sections: [
          makeSection("instruction", "instruction"),
          makeSection("custom", "context"),
          makeSection("examples", "examples"),
          makeSection("custom", "output_format"),
        ],
      }),
    );
    expect(result.indexOf("<instructions>")).toBeLessThan(result.indexOf("<context>"));
    expect(result.indexOf("<context>")).toBeLessThan(result.indexOf("<examples>"));
    expect(result.indexOf("<examples>")).toBeLessThan(result.indexOf("<output_format>"));
  });

  it("同じ中身でもカードを入れ替えれば順番が変わる", () => {
    const shared = {
      examples: [{ ...emptyExample("a"), input: "本文" }],
      customSections: [node("context", "背景")],
    };
    const before = buildPrompt(
      draft({
        ...shared,
        sections: [makeSection("custom", "context"), makeSection("examples", "examples")],
      }),
    );
    const after = buildPrompt(
      draft({
        ...shared,
        sections: [makeSection("examples", "examples"), makeSection("custom", "context")],
      }),
    );
    expect(before.indexOf("<context>")).toBeLessThan(before.indexOf("<examples>"));
    expect(after.indexOf("<examples>")).toBeLessThan(after.indexOf("<context>"));
  });

  it("カスタムセクションだけでも実入力の枠が付く", () => {
    const result = buildPrompt(
      withRealInput({ customSections: [node("context", "背景")] }),
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

describe("Role（System / User の分割出力）", () => {
  it("Role が空なら system は空文字列", () => {
    expect(buildFull(draft()).system).toBe("");
  });

  it("Role は素のテキストで system に入る（タグで包まない）", () => {
    const built = buildFull(draft({ role: "  あなたは経験豊富な編集者です。  " }));
    expect(built.system).toBe("あなたは経験豊富な編集者です。");
    expect(built.user).not.toContain("role");
  });

  it("BuiltPrompt に prefill は存在しない", () => {
    expect("prefill" in buildFull(draft({ role: "編集者", instruction: "要約する" }))).toBe(false);
  });

  it("flattenPrompt は assistant ターンを出さない", () => {
    const built = buildFull(draft({ role: "編集者", instruction: "要約する" }));
    expect(flattenPrompt(built)).toBe(
      "[system]\n編集者\n\n[user]\n<instructions>\n要約する\n</instructions>",
    );
    expect(flattenPrompt(built)).not.toContain("[assistant]");
  });

  it("Role だけなら user は空のまま", () => {
    const built = buildFull(draft({ role: "編集者" }));
    expect(built.user).toBe("");
    expect(flattenPrompt(built)).toBe("[system]\n編集者");
  });
});

describe("撤去した Chain-of-Thought", () => {
  it("thinking_instructions はもう出ない", () => {
    const result = buildPrompt(draft({ instruction: "要約する" }));
    expect(result).not.toContain("thinking_instructions");
    expect(result).toBe("<instructions>\n要約する\n</instructions>");
  });

  it("chainOfThought を持つ旧データを渡しても無視される", () => {
    const legacy = { ...draft({ instruction: "要約する" }), chainOfThought: true } as never;
    expect(buildFull(legacy).user).not.toContain("thinking_instructions");
  });
});

describe("制約リスト", () => {
  it("箇条書きで constraints に入る", () => {
    expect(buildPrompt(draft({ constraints: ["200字以内", "敬体で書く"] }))).toBe(
      "<constraints>\n- 200字以内\n- 敬体で書く\n</constraints>",
    );
  });

  it("空文字列と空白だけの項目は落とす", () => {
    expect(buildPrompt(draft({ constraints: ["", "  ", "200字以内"] }))).toBe(
      "<constraints>\n- 200字以内\n</constraints>",
    );
  });

  it("有効な項目が0件なら constraints ごと出ない", () => {
    expect(buildPrompt(draft({ constraints: ["", "   "] }))).toBe("");
  });
});

describe("ネガティブ例", () => {
  const bad = { ...emptyExample("b"), kind: "negative" as const, input: "入力", thinking: "冗長", idealOutput: "だめな出力" };

  it("negative_examples 側に振り分け、タグ名を読み替える", () => {
    const result = buildPrompt(draft({ examples: [bad] }));
    expect(result).toBe(
      "<negative_examples>\n<negative_example>\n<input>\n入力\n</input>\n" +
        "<why_wrong>\n冗長\n</why_wrong>\n<bad_output>\nだめな出力\n</bad_output>\n" +
        "</negative_example>\n</negative_examples>",
    );
  });

  it("良い例と悪い例を別ブロックに分け、良い例を先に置く", () => {
    const good = { ...emptyExample("g"), input: "良い入力" };
    const result = buildPrompt(draft({ examples: [bad, good] }));
    expect(result.indexOf("<examples>")).toBeLessThan(result.indexOf("<negative_examples>"));
    expect(result.match(/<example>/g)).toHaveLength(1);
    expect(result.match(/<negative_example>/g)).toHaveLength(1);
  });

  it("kind 未指定は良い例として扱う（旧データ互換）", () => {
    const legacy = { id: "l", input: "入力", thinking: "", idealOutput: "" };
    expect(buildPrompt(draft({ examples: [legacy] }))).toContain("<examples>");
  });

  it("3項目すべて空の悪い例は落ちる", () => {
    expect(buildPrompt(draft({ examples: [{ ...emptyExample("b"), kind: "negative" }] }))).toBe("");
  });
});

describe("長文ドキュメント", () => {
  const doc = (source: string, content: string, id = source || content) => ({
    ...emptyDocument(id),
    source,
    content,
  });

  it("index は1始まりで採番する", () => {
    const result = buildPrompt(draft({ documents: [doc("a.md", "本文A"), doc("b.md", "本文B")] }));
    expect(result).toContain('<document index="1">');
    expect(result).toContain('<document index="2">');
  });

  it("source が空なら source 行ごと省く", () => {
    expect(buildPrompt(draft({ documents: [doc("", "本文")] }))).toBe(
      '<documents>\n<document index="1">\n<document_content>\n本文\n</document_content>\n</document>\n</documents>',
    );
  });

  it("本文が空のドキュメントは飛ばし、index を詰める", () => {
    const result = buildPrompt(draft({ documents: [doc("a.md", "", "a"), doc("b.md", "本文B")] }));
    expect(result).toContain('<document index="1">');
    expect(result).not.toContain('index="2"');
    expect(result).not.toContain("a.md");
  });

  it("ドキュメントは instructions より前に置く", () => {
    const result = buildPrompt(draft({ instruction: "要約する", documents: [doc("a.md", "本文")] }));
    expect(result.indexOf("<documents>")).toBeLessThan(result.indexOf("<instructions>"));
  });

  it("有効なドキュメントが0件なら documents ごと出ない", () => {
    expect(buildPrompt(draft({ documents: [doc("a.md", "", "a")] }))).toBe("");
  });
});

describe("カード順が出力順になる", () => {
  const base = {
    instruction: "要約する",
    constraints: ["200字以内"],
    examples: [{ ...emptyExample("g"), input: "本文" }],
    documents: [{ ...emptyDocument("d"), source: "a.md", content: "資料" }],
  };

  /** 旧 long-context モード相当 — 指示まわりを examples の後ろへ回した並び。 */
  const tailDirectives = [
    makeSection("documents", "documents"),
    makeSection("examples", "examples"),
    makeSection("instruction", "instruction"),
    makeSection("constraints", "constraints"),
    makeSection("realInput", "realInput"),
  ];

  it("既定の並びでは instructions が examples より前", () => {
    const result = buildPrompt(draft(base));
    expect(result.indexOf("<instructions>")).toBeLessThan(result.indexOf("<examples>"));
  });

  it("指示カードを下へ動かせば examples の後ろに出る", () => {
    const result = buildPrompt(draft({ ...base, sections: tailDirectives }));
    const examples = result.indexOf("<examples>");
    expect(examples).toBeLessThan(result.indexOf("<instructions>"));
    expect(examples).toBeLessThan(result.indexOf("<constraints>"));
  });

  it("先頭に置いたドキュメントは先頭のまま", () => {
    const result = buildPrompt(draft({ ...base, sections: tailDirectives }));
    expect(result.indexOf("<documents>")).toBe(0);
  });

  it("末尾に置いた実入力の枠は最後に出る", () => {
    const result = buildPrompt(draft({ ...base, sections: tailDirectives }));
    expect(result.endsWith("<input>\n{{INPUT}}\n</input>")).toBe(true);
  });

  it("role と outputSchema はどこに置いても user ターンに出ない", () => {
    const result = buildPrompt(
      draft({
        role: "編集者",
        instruction: "要約する",
        outputSchema: '{"type":"object"}',
        sections: [
          makeSection("role", "role"),
          makeSection("outputSchema", "outputSchema"),
          makeSection("instruction", "instruction"),
        ],
      }),
    );
    expect(result).toBe("<instructions>\n要約する\n</instructions>");
  });

  it("実入力の枠カードが無ければ {{INPUT}} は出ない", () => {
    expect(buildPrompt(draft({ instruction: "要約する" }))).not.toContain("{{INPUT}}");
  });

  it("カードはあっても中身が空なら出力に出ない", () => {
    const result = buildPrompt(
      draft({
        instruction: "要約する",
        sections: [
          makeSection("instruction", "instruction"),
          makeSection("constraints", "constraints"),
          makeSection("examples", "examples"),
          makeSection("documents", "documents"),
        ],
      }),
    );
    expect(result).toBe("<instructions>\n要約する\n</instructions>");
  });
});

describe("CSS スタイルトークン", () => {
  const token = (name: string, overrides: Partial<StyleToken> = {}): StyleToken => ({
    ...emptyStyleToken(name || "empty"),
    name,
    ...overrides,
  });

  it("style カードがあれば style_tokens ブロックを出す", () => {
    expect(buildPrompt(draft({ styleTokens: [token("brand primary")] }))).toBe(
      "<style_tokens>\n--brand-primary: #ff5733;\n</style_tokens>",
    );
  });

  it("トークンが0件ならブロックごと出ない", () => {
    const result = buildPrompt(
      draft({
        instruction: "要約する",
        sections: [makeSection("styleTokens", "styleTokens"), makeSection("instruction", "instruction")],
      }),
    );
    expect(result).toBe("<instructions>\n要約する\n</instructions>");
  });

  it("名前が全て空ならブロックごと出ない", () => {
    expect(buildPrompt(draft({ styleTokens: [token(""), token("@@@")] }))).toBe("");
  });

  it("囲みタグ名を尊重し、sanitizeTag を通す", () => {
    const result = buildPrompt(
      draft({ styleTokens: [token("brand primary")], styleTagName: "design tokens" }),
    );
    expect(result.startsWith("<design_tokens>")).toBe(true);
    expect(result.endsWith("</design_tokens>")).toBe(true);
  });

  it("タグ名が使えない文字だけなら既定の style_tokens に戻す", () => {
    const result = buildPrompt(draft({ styleTokens: [token("brand")], styleTagName: "///" }));
    expect(result).toContain("<style_tokens>");
  });

  it("出力モードを切り替えると行の書き方が変わる", () => {
    const tokens = [token("brand primary", { apply: "color" })];
    expect(buildPrompt(draft({ styleTokens: tokens, styleOutputMode: "declarations" }))).toBe(
      "<style_tokens>\ncolor: #ff5733;\n</style_tokens>",
    );
  });

  it("アルファ付きの単色は rgba() で出す", () => {
    const half = token("brand", { value: { color: { r: 51, g: 193, b: 255, a: 0.5 } } });
    expect(buildPrompt(draft({ styleTokens: [half] }))).toContain(
      "--brand: rgba(51, 193, 255, 0.5);",
    );
  });

  it("カード順どおりの位置に出る", () => {
    const shared = { instruction: "要約する", styleTokens: [token("brand")] };
    const before = buildPrompt(
      draft({
        ...shared,
        sections: [makeSection("styleTokens", "styleTokens"), makeSection("instruction", "instruction")],
      }),
    );
    const after = buildPrompt(
      draft({
        ...shared,
        sections: [makeSection("instruction", "instruction"), makeSection("styleTokens", "styleTokens")],
      }),
    );
    expect(before.indexOf("<style_tokens>")).toBeLessThan(before.indexOf("<instructions>"));
    expect(after.indexOf("<instructions>")).toBeLessThan(after.indexOf("<style_tokens>"));
  });

  it("blocks にラベル付きで載り、連結が user と一致する", () => {
    const built = buildFull(draft({ instruction: "要約する", styleTokens: [token("brand")] }));
    expect(built.blocks.map((b) => b.label)).toContain("<style_tokens>");
    expect(built.blocks.map((b) => b.text).join("\n\n")).toBe(built.user);
  });
});

describe("blocks（トークン内訳の材料）", () => {
  it("出力した順にラベル付きで並ぶ", () => {
    const built = buildFull(
      draft({
        instruction: "要約する",
        constraints: ["200字以内"],
        examples: [{ ...emptyExample("g"), input: "本文" }],
        sections: [
          makeSection("instruction", "instruction"),
          makeSection("constraints", "constraints"),
          makeSection("examples", "examples"),
          makeSection("realInput", "realInput"),
        ],
      }),
    );
    expect(built.blocks.map((b) => b.label)).toEqual([
      "<instructions>",
      "<constraints>",
      "<examples>",
      "<input>",
    ]);
  });

  it("blocks を連結すると user と一致する", () => {
    const built = buildFull(draft({ instruction: "要約する", constraints: ["短く"] }));
    expect(built.blocks.map((b) => b.text).join("\n\n")).toBe(built.user);
  });

  it("カスタムタグはタグ名がラベルになる", () => {
    const built = buildFull(
      draft({ customSections: [{ id: "c", tag: "output format", content: "箇条書き", children: [] }] }),
    );
    expect(built.blocks[0].label).toBe("<output_format>");
  });
});
