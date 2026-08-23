import { buildPrompt, estimateTokens, sanitizeTag } from "./buildPrompt";
import { parseSchema } from "./outputConfig";
import { extractVariables } from "./variables";
import type { Example, PromptDraft } from "./types";

export type LintSeverity = "warn" | "info";

export type LintFinding = {
  id: string;
  severity: LintSeverity;
  message: string;
  hint: string;
};

/** これを下回る指示は曖昧すぎる可能性が高い、という目安。 */
const VAGUE_INSTRUCTION_CHARS = 15;

/** 指示を末尾に寄せる効果が出はじめるおおよその境目。 */
const LONG_CONTEXT_TOKENS = 20_000;

/** 出力形式を指定していると判断するタグ名。 */
const FORMAT_TAGS = ["output_format", "format", "response_format", "output", "schema"];

/** 3項目のどれかに中身がある Example だけを数える。 */
function isFilled(example: Example): boolean {
  return Boolean(
    example.input.trim() || example.thinking.trim() || example.idealOutput.trim(),
  );
}

/**
 * 下書きを静的に点検する。外部通信もモデル呼び出しもせず、
 * ルールはすべて決定的に評価する。
 */
export function lintDraft(draft: PromptDraft): LintFinding[] {
  const findings: LintFinding[] = [];
  const built = buildPrompt(draft);

  if (!draft.instruction.trim()) {
    findings.push({
      id: "no-instruction",
      severity: "warn",
      message: "Instruction が空です",
      hint: "何をしてほしいかを最初に書くのが、いちばん効果の大きい一手です。",
    });
  } else if (draft.instruction.trim().length < VAGUE_INSTRUCTION_CHARS) {
    findings.push({
      id: "vague-instruction",
      severity: "info",
      message: "Instruction が短すぎるかもしれません",
      hint: "対象・目的・出力の粒度まで書くと、解釈のぶれが減ります。",
    });
  }

  const filled = draft.examples.filter(isFilled);
  const positives = filled.filter((example) => (example.kind ?? "positive") === "positive");

  if (positives.length === 0) {
    findings.push({
      id: "no-examples",
      severity: "warn",
      message: "example が1件もありません",
      hint: "few-shot は精度をいちばん大きく動かします。まず1件足してみてください。",
    });
  } else if (positives.length < 3) {
    findings.push({
      id: "few-examples",
      severity: "info",
      message: `example が${positives.length}件です`,
      hint: "3件以上あると出力が安定しやすくなります。",
    });
  }

  if (draft.chainOfThought) {
    findings.push({
      id: "cot-not-needed",
      severity: "info",
      message: "Chain-of-Thought は現行の Claude では不要です",
      hint: "現行モデルは内部で思考します。深さは output_config.effort で指定してください。",
    });
  }

  if (filled.some((example) => example.thinking.trim())) {
    findings.push({
      id: "example-thinking-redundant",
      severity: "info",
      message: "example に thinking が入っています",
      hint: "現行モデルは内部で思考するため、省いても結果が変わりにくい欄です。",
    });
  }

  const hasConstraints = draft.constraints.some((item) => item.trim());
  const hasFormatTag = draft.customSections.some((section) =>
    FORMAT_TAGS.includes(sanitizeTag(section.tag).toLowerCase()),
  );
  const schema = parseSchema(draft.outputSchema);
  if (schema.status === "error") {
    findings.push({
      id: "invalid-output-schema",
      severity: "warn",
      message: "Output schema が JSON として読めません",
      hint: `直すまで output_config には出力されません: ${schema.message}`,
    });
  }

  if (!hasConstraints && !hasFormatTag && schema.status !== "ok") {
    findings.push({
      id: "no-output-format",
      severity: "info",
      message: "出力形式の指定がありません",
      hint: "JSON がほしいなら Output schema（structured outputs）が確実です。文章なら constraints でも足ります。",
    });
  }

  if (!draft.longContextMode && estimateTokens(built.user) > LONG_CONTEXT_TOKENS) {
    findings.push({
      id: "long-context-off",
      severity: "info",
      message: "プロンプトが長いのに long-context モードが OFF です",
      hint: "長文では指示を末尾に寄せたほうが、指示を取りこぼしにくくなります。",
    });
  }

  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const section of draft.customSections) {
    const tag = sanitizeTag(section.tag);
    if (!tag) continue;
    if (seen.has(tag)) duplicated.add(tag);
    seen.add(tag);
  }
  if (duplicated.size > 0) {
    findings.push({
      id: "duplicate-tag",
      severity: "info",
      message: `同じタグ名が重複しています: ${[...duplicated].map((tag) => `<${tag}>`).join(", ")}`,
      hint: "役割ごとに名前を分けると、どこを読めばよいかが伝わりやすくなります。",
    });
  }

  // INPUT は使うときに差し替える枠なので、未設定が正常。毎回警告しても意味がない。
  const unset = extractVariables(draft).filter(
    (name) => name !== "INPUT" && !draft.variableValues[name],
  );
  if (unset.length > 0) {
    findings.push({
      id: "unset-variable",
      severity: "info",
      message: `テスト値が未設定の変数があります: ${unset.map((name) => `{{${name}}}`).join(", ")}`,
      hint: "値を入れるとプレビューで完成形を確認できます。空のままでも出力には影響しません。",
    });
  }

  return findings;
}
