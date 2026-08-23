"use client";

import { useId, useMemo } from "react";
import { parseSchema, SCHEMA_TEMPLATE } from "@/lib/outputConfig";
import type { Effort } from "@/lib/types";

type Props = {
  schema: string;
  effort: Effort;
  onChangeSchema: (schema: string) => void;
  onChangeEffort: (effort: Effort) => void;
};

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "", label: "指定しない" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high（既定）" },
  { value: "xhigh", label: "xhigh" },
  { value: "max", label: "max" },
];

export default function OutputSchemaEditor({
  schema,
  effort,
  onChangeSchema,
  onChangeEffort,
}: Props) {
  const schemaId = useId();
  const effortId = useId();
  const state = useMemo(() => parseSchema(schema), [schema]);

  return (
    <div className="schema-editor">
      <div className="schema-row">
        <label className="schema-caption" htmlFor={effortId}>
          effort
        </label>
        <select
          id={effortId}
          className="effort-select"
          value={effort}
          onChange={(event) => onChangeEffort(event.target.value as Effort)}
        >
          {EFFORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="schema-note">
          思考の深さ。xhigh は Opus 4.7 以降、Sonnet 4.5 / Haiku 4.5 では effort 自体が使えません
        </span>
      </div>

      <div className="field">
        <div className="field-head">
          <label className="tag-label" htmlFor={schemaId}>
            JSON Schema
          </label>
          <span className="field-meta">
            {state.status === "error" && (
              <span className="warn" role="status">
                ⚠ {state.message}
              </span>
            )}
            {state.status === "ok" && <span className="counter">OK</span>}
            <button
              type="button"
              className="text-button"
              onClick={() => onChangeSchema(SCHEMA_TEMPLATE)}
            >
              雛形を入れる
            </button>
          </span>
        </div>
        <textarea
          id={schemaId}
          className="schema-input"
          rows={8}
          value={schema}
          spellCheck={false}
          placeholder="出力させたい JSON の形（output_config.format に渡します）"
          onChange={(event) => onChangeSchema(event.target.value)}
        />
      </div>

      <p className="variable-note">
        ここはプロンプト本文ではなく API パラメータです。Prompt 欄の Output config
        にそのまま貼れる形で出ます。
      </p>
    </div>
  );
}
