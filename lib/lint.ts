import { sanitizeTag } from "./buildPrompt";
import { activeCustomIds, hasSection } from "./sections";
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
/** まだ何も書いていない下書きか。ここで真なら助言する相手がいない。 */
function isBlank(draft: PromptDraft): boolean {
  const v = visible(draft);
  return (
    !v.role.trim() &&
    !v.instruction.trim() &&
    !v.outputSchema.trim() &&
    !v.constraints.some((item) => item.trim()) &&
    !v.documents.some((doc) => doc.source.trim() || doc.content.trim()) &&
    !v.examples.some(isFilled) &&
    v.customSections.length === 0
  );
}

/**
 * 今あるカードの中身だけを取り出す。
 * カードを消した項目は出力に出ないので、助言の対象からも外す
 * （消したはずの example の変数を指摘する、といった食い違いを防ぐ）。
 */
function visible(draft: PromptDraft) {
  const has = (kind: Parameters<typeof hasSection>[1]) => hasSection(draft.sections, kind);
  const active = activeCustomIds(draft.sections);
  return {
    role: has("role") ? draft.role : "",
    instruction: has("instruction") ? draft.instruction : "",
    outputSchema: has("outputSchema") ? draft.outputSchema : "",
    constraints: has("constraints") ? draft.constraints : [],
    documents: has("documents") ? draft.documents : [],
    examples: has("examples") ? draft.examples : [],
    customSections: draft.customSections.filter((node) => active.has(node.id)),
  };
}

export function lintDraft(draft: PromptDraft): LintFinding[] {
  // 白紙の画面に指摘を並べても急かすだけなので、書き始めるまでは黙る。
  if (isBlank(draft)) return [];

  const findings: LintFinding[] = [];
  const v = visible(draft);

  if (!v.instruction.trim()) {
    findings.push({
      id: "no-instruction",
      severity: "warn",
      message: "Instruction が空です",
      hint: "何をしてほしいかを最初に書くのが、いちばん効果の大きい一手です。",
    });
  } else if (v.instruction.trim().length < VAGUE_INSTRUCTION_CHARS) {
    findings.push({
      id: "vague-instruction",
      severity: "info",
      message: "Instruction が短すぎるかもしれません",
      hint: "対象・目的・出力の粒度まで書くと、解釈のぶれが減ります。",
    });
  }

  const filled = v.examples.filter(isFilled);
  const positives = filled.filter((example) => (example.kind ?? "positive") === "positive");

  // 指示すら固まっていない段階で example を急かしても仕方がない。
  if (positives.length === 0 && v.instruction.trim()) {
    findings.push({
      id: "no-examples",
      severity: "info",
      message: "example がありません",
      hint: "使わなくても動きますが、few-shot は精度をいちばん大きく動かす手です。",
    });
  } else if (positives.length > 0 && positives.length < 3) {
    findings.push({
      id: "few-examples",
      severity: "info",
      message: `example が${positives.length}件です`,
      hint: "3件以上あると出力が安定しやすくなります。",
    });
  }

  const hasConstraints = v.constraints.some((item) => item.trim());
  const hasFormatTag = v.customSections.some((section) =>
    FORMAT_TAGS.includes(sanitizeTag(section.tag).toLowerCase()),
  );
  const schema = parseSchema(v.outputSchema);
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

  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const section of v.customSections) {
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
