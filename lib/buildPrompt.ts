import { buildStyleCss } from "./styleTokens";
import type { CustomNode, Example, PromptDraft, Section } from "./types";

/** 末尾に置く実入力ブロックの差し替え用プレースホルダ。 */
export const REAL_INPUT_PLACEHOLDER = "{{INPUT}}";

const REAL_INPUT_LEAD = "Now here is the real input.";

/** ネストしたカスタムタグ1段あたりのインデント幅。 */
const INDENT = "  ";

/** 本文に混ざると生成プロンプトの構造を壊す閉じタグ。 */
const CLOSING_TAGS = [
  "</instructions>",
  "</examples>",
  "</example>",
  "</negative_examples>",
  "</negative_example>",
  "</input>",
  "</thinking>",
  "</ideal_output>",
  "</why_wrong>",
  "</bad_output>",
  "</constraints>",
  "</documents>",
  "</document>",
  "</document_content>",
  "</style_tokens>",
] as const;

/** user ターンを構成する1ブロック。トークン内訳の表示にそのまま使う。 */
export type PromptBlock = { label: string; text: string };

export type BuiltPrompt = {
  system: string;
  user: string;
  blocks: PromptBlock[];
};

/** タグと本文を必ず別行に分けて包む。 */
function block(tag: string, body: string): string {
  return `<${tag}>\n${body}\n</${tag}>`;
}

/** 属性つきの開始タグで包む。属性値の二重引用符だけは実体参照に逃がす。 */
function blockWithAttrs(tag: string, attrs: Record<string, string>, body: string): string {
  const rendered = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${value.replace(/"/g, "&quot;")}"`)
    .join("");
  return `<${tag}${rendered}>\n${body}\n</${tag}>`;
}

/** 空行はそのままに、各行へインデントを足す。 */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? INDENT + line : line))
    .join("\n");
}

/**
 * 入力されたタグ名を XML の要素名として使える形に整える。
 * 空白は `_` に潰し、タグ構造を壊す文字は落とす。使えない場合は空文字列を返す。
 */
export function sanitizeTag(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, "_");
  // 英数字・アンダースコア・ハイフン・ドット、および日本語を許可する。
  const stripped = collapsed.replace(/[^A-Za-z0-9_.\-぀-ゟ゠-ヿ一-鿿]/g, "");
  if (!stripped) return "";
  // XML の要素名は数字・ハイフン・ドットで始められない。
  return /^[0-9.\-]/.test(stripped) ? `_${stripped}` : stripped;
}

/**
 * カスタムタグのノードを再帰的に組み立てる。
 * タグ名が無い、または本文も子も空のノードは丸ごと省略する。
 */
function buildNode(node: CustomNode): string | null {
  const tag = sanitizeTag(node.tag);
  if (!tag) return null;

  const content = node.content.trim();
  const children = node.children
    .map(buildNode)
    .filter((child): child is string => child !== null);

  if (!content && children.length === 0) return null;

  const inner = [...(content ? [content] : []), ...children].join("\n");
  return block(tag, indent(inner));
}

/** 良い例。3項目すべて空なら null。 */
function buildPositiveExample(example: Example): string | null {
  const parts: string[] = [];
  const input = example.input.trim();
  const thinking = example.thinking.trim();
  const idealOutput = example.idealOutput.trim();

  if (input) parts.push(block("input", input));
  if (thinking) parts.push(block("thinking", thinking));
  if (idealOutput) parts.push(block("ideal_output", idealOutput));

  return parts.length > 0 ? block("example", parts.join("\n")) : null;
}

/**
 * 悪い例。フィールドの意味が変わるのでタグ名を読み替える。
 * thinking は「なぜダメか」、ideal output は「やってはいけない出力」。
 */
function buildNegativeExample(example: Example): string | null {
  const parts: string[] = [];
  const input = example.input.trim();
  const whyWrong = example.thinking.trim();
  const badOutput = example.idealOutput.trim();

  if (input) parts.push(block("input", input));
  if (whyWrong) parts.push(block("why_wrong", whyWrong));
  if (badOutput) parts.push(block("bad_output", badOutput));

  return parts.length > 0 ? block("negative_example", parts.join("\n")) : null;
}

function buildDocuments(draft: PromptDraft): PromptBlock[] {
  const entries: string[] = [];
  for (const document of draft.documents) {
    const content = document.content.trim();
    const source = document.source.trim();
    // 本文が無いドキュメントは出典だけあっても意味がないので落とす。
    if (!content) continue;

    const parts = [
      ...(source ? [block("source", source)] : []),
      block("document_content", content),
    ];
    // index は出力に載る順で1始まり。空ドキュメントを飛ばした分は詰める。
    entries.push(
      blockWithAttrs("document", { index: String(entries.length + 1) }, parts.join("\n")),
    );
  }
  if (entries.length === 0) return [];
  return [{ label: "<documents>", text: block("documents", entries.join("\n")) }];
}

function buildConstraints(draft: PromptDraft): PromptBlock[] {
  const items = draft.constraints.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return [];
  // 1行1要素をタグで包むより箇条書きのほうが短く、伝わり方は変わらない。
  return [
    {
      label: "<constraints>",
      text: block("constraints", items.map((item) => `- ${item}`).join("\n")),
    },
  ];
}

function buildExamples(draft: PromptDraft): PromptBlock[] {
  const positives = draft.examples
    .filter((example) => (example.kind ?? "positive") === "positive")
    .map(buildPositiveExample)
    .filter((text): text is string => text !== null);

  const negatives = draft.examples
    .filter((example) => example.kind === "negative")
    .map(buildNegativeExample)
    .filter((text): text is string => text !== null);

  const blocks: PromptBlock[] = [];
  if (positives.length > 0) {
    blocks.push({ label: "<examples>", text: block("examples", positives.join("\n")) });
  }
  if (negatives.length > 0) {
    blocks.push({
      label: "<negative_examples>",
      text: block("negative_examples", negatives.join("\n")),
    });
  }
  return blocks;
}

/** CSS スタイルトークン。使える行が1つも無ければブロックごと省く。 */
function buildStyleTokens(draft: PromptDraft): PromptBlock[] {
  const css = buildStyleCss(draft.styleTokens, draft.styleOutputMode);
  if (!css) return [];
  const tag = sanitizeTag(draft.styleTagName) || "style_tokens";
  // CSS は行頭の位置に意味があるので、カスタムタグと違ってインデントしない。
  return [{ label: `<${tag}>`, text: block(tag, css) }];
}

function buildCustom(draft: PromptDraft, section: Section): PromptBlock[] {
  const node = draft.customSections.find((entry) => entry.id === section.id);
  if (!node) return [];
  const text = buildNode(node);
  if (!text) return [];
  return [{ label: `<${sanitizeTag(node.tag)}>`, text }];
}

/** そのカード1枚が user ターンに出すブロック。出すものが無ければ空配列。 */
function blocksFor(draft: PromptDraft, section: Section): PromptBlock[] {
  switch (section.kind) {
    // role は system、outputSchema は output_config へ入るので user には出ない。
    case "role":
    case "outputSchema":
      return [];
    case "instruction": {
      const instruction = draft.instruction.trim();
      if (!instruction) return [];
      return [{ label: "<instructions>", text: block("instructions", instruction) }];
    }
    case "constraints":
      return buildConstraints(draft);
    case "documents":
      return buildDocuments(draft);
    case "examples":
      return buildExamples(draft);
    case "styleTokens":
      return buildStyleTokens(draft);
    case "custom":
      return buildCustom(draft, section);
    case "realInput":
      return [
        {
          label: "<input>",
          text: `${REAL_INPUT_LEAD}\n\n${block("input", REAL_INPUT_PLACEHOLDER)}`,
        },
      ];
  }
}

/**
 * 下書きから XML 構造化プロンプトを組み立てる。
 * カードの並び順がそのまま user ターンの並び順になる。
 * 空のフィールドはタグごと省略し、中身が何もなければ user は空文字列になる。
 */
export function buildPrompt(draft: PromptDraft): BuiltPrompt {
  const blocks: PromptBlock[] = [];
  for (const section of draft.sections) {
    blocks.push(...blocksFor(draft, section));
  }

  // 実入力の枠だけが残っても意味がないので、他に何も無ければ落とす。
  const meaningful = blocks.filter((entry) => entry.label !== "<input>");
  const finalBlocks = meaningful.length > 0 ? blocks : [];

  return {
    system: draft.role.trim(),
    user: finalBlocks.map((entry) => entry.text).join("\n\n"),
    blocks: finalBlocks,
  };
}

/** 「全部まとめてコピー」用に各ターンを1つのテキストへ落とす。 */
export function flattenPrompt(built: BuiltPrompt): string {
  const parts: string[] = [];
  if (built.system) parts.push(`[system]\n${built.system}`);
  if (built.user) parts.push(`[user]\n${built.user}`);
  return parts.join("\n\n");
}

/**
 * 本文に閉じタグが混ざっていて生成結果の構造が壊れるかどうか。
 * extraTags にはユーザーが作ったカスタムタグ名を渡す（`context` → `</context>` を検出）。
 */
export function hasTagCollision(text: string, extraTags: string[] = []): boolean {
  if (CLOSING_TAGS.some((tag) => text.includes(tag))) return true;
  return extraTags.some((tag) => tag && text.includes(`</${tag}>`));
}

/** 下書きの中で実際に出力されるカスタムタグ名を集める（入れ子も含む）。 */
export function customTagNames(nodes: CustomNode[]): string[] {
  const names: string[] = [];
  const walk = (list: CustomNode[]) => {
    for (const node of list) {
      const tag = sanitizeTag(node.tag);
      if (tag) names.push(tag);
      walk(node.children);
    }
  };
  walk(nodes);
  return [...new Set(names)];
}

/** ひらがな・カタカナ・漢字・半角カナ。 */
const JAPANESE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

/**
 * 文字数と、英文とみなせる場合のみ単語数を返す。
 * 日本語の文字を1つも含まない場合だけ英文と判定する。
 */
export function countText(text: string): { chars: number; words: number | null } {
  const chars = text.length;
  const compact = text.replace(/\s/g, "");
  if (compact.length === 0) return { chars, words: null };

  // 仮名・漢字が1文字でもあれば日本語とみなし、単語数は出さない。
  if (JAPANESE.test(compact)) return { chars, words: null };

  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'’.\-]*/g)?.length ?? 0;
  return { chars, words: words > 0 ? words : null };
}

/**
 * トークン数のごく粗い概算。ASCII は約4文字で1トークン、
 * 日本語などの非 ASCII は1文字あたり約0.7トークンとして見積もる。
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let nonAscii = 0;
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) < 128) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.7);
}
