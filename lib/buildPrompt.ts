import type { PromptDraft } from "./types";

/** 末尾に置く実入力ブロックの差し替え用プレースホルダ。 */
export const REAL_INPUT_PLACEHOLDER = "{{INPUT}}";

const REAL_INPUT_LEAD = "Now here is the real input.";

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
