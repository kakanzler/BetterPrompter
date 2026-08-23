import type { CustomNode, Placement, PromptDraft } from "./types";

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
  "</input>",
  "</thinking>",
  "</ideal_output>",
] as const;

/** タグと本文を必ず別行に分けて包む。 */
function block(tag: string, body: string): string {
  return `<${tag}>\n${body}\n</${tag}>`;
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
  const stripped = collapsed.replace(
    /[^A-Za-z0-9_.\-\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g,
    "",
  );
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

function sectionsFor(draft: PromptDraft, placement: Placement): string[] {
  return draft.customSections
    .filter((section) => (section.placement ?? "before") === placement)
    .map(buildNode)
    .filter((section): section is string => section !== null);
}

/**
 * 下書きから XML 構造化プロンプトを組み立てる。
 * 空のフィールドはタグごと省略し、中身が何もなければ空文字列を返す。
 */
export function buildPrompt(draft: PromptDraft): string {
  const blocks: string[] = [];

  const instruction = draft.instruction.trim();
  if (instruction) {
    blocks.push(block("instructions", instruction));
  }

  blocks.push(...sectionsFor(draft, "before"));

  const exampleBlocks: string[] = [];
  for (const example of draft.examples) {
    const parts: string[] = [];
    const input = example.input.trim();
    const thinking = example.thinking.trim();
    const idealOutput = example.idealOutput.trim();

    if (input) parts.push(block("input", input));
    if (thinking) parts.push(block("thinking", thinking));
    if (idealOutput) parts.push(block("ideal_output", idealOutput));

    // 3項目すべて空の Example は丸ごと落とす。
    if (parts.length > 0) {
      exampleBlocks.push(block("example", parts.join("\n")));
    }
  }

  if (exampleBlocks.length > 0) {
    blocks.push(block("examples", exampleBlocks.join("\n")));
  }

  blocks.push(...sectionsFor(draft, "after"));

  // 中身が何もない状態で実入力の枠だけを出しても意味がないので、その場合は付けない。
  if (draft.includeRealInput && blocks.length > 0) {
    blocks.push(`${REAL_INPUT_LEAD}\n\n${block("input", REAL_INPUT_PLACEHOLDER)}`);
  }

  return blocks.join("\n\n");
}

/** 本文に閉じタグが混ざっていて生成結果の構造が壊れるかどうか。 */
export function hasTagCollision(text: string): boolean {
  return CLOSING_TAGS.some((tag) => text.includes(tag));
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
  // 割合で判定すると境界が読めないので、含むか否かで割り切る。
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
