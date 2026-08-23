import type { Effort, PromptDraft } from "./types";

/** 「雛形を入れる」ボタンが挿入する最小のオブジェクトスキーマ。 */
export const SCHEMA_TEMPLATE = `{
  "type": "object",
  "properties": {
    "summary": { "type": "string" }
  },
  "required": ["summary"],
  "additionalProperties": false
}`;

export type SchemaState =
  | { status: "empty" }
  | { status: "ok"; value: unknown }
  | { status: "error"; message: string };

/**
 * 入力された JSON Schema を検証する。
 * 壊れていてもここでは投げず、状態として返して UI に出させる。
 */
export function parseSchema(raw: string): SchemaState {
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" };

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "JSON として解析できません",
    };
  }

  // JSON Schema はオブジェクトでなければならない（true/false や配列は受け付けない）。
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { status: "error", message: "スキーマは JSON オブジェクトである必要があります" };
  }

  return { status: "ok", value };
}

/**
 * そのまま API に渡せる output_config を組み立てる。
 * 指定が何も無ければ null を返し、UI 側でブロックごと出さない。
 *
 * effort の既定は high なので、"" は「指定しない」＝キーを出さない、を意味する。
 */
export function buildOutputConfig(draft: PromptDraft): string | null {
  const config: { effort?: Effort; format?: { type: string; schema: unknown } } = {};

  if (draft.effort) config.effort = draft.effort;

  const schema = parseSchema(draft.outputSchema);
  if (schema.status === "ok") {
    config.format = { type: "json_schema", schema: schema.value };
  }

  if (Object.keys(config).length === 0) return null;
  return JSON.stringify(config, null, 2);
}
