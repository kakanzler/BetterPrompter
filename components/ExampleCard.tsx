"use client";

import AutoTextarea from "./AutoTextarea";
import type { Example, ExampleKind } from "@/lib/types";

type Props = {
  example: Example;
  index: number;
  total: number;
  onChange: (patch: Partial<Example>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

/** 悪い例ではフィールドの意味が変わるので、ラベルも読み替える。 */
const LABELS: Record<ExampleKind, { input: string; middle: string; output: string }> = {
  positive: { input: "<input>", middle: "<thinking>", output: "<ideal output>" },
  negative: { input: "<input>", middle: "<why wrong>", output: "<bad output>" },
};

export default function ExampleCard({ example, index, total, onChange, onDelete, onMove }: Props) {
  const collapsed = example.collapsed === true;
  const kind: ExampleKind = example.kind ?? "positive";
  const labels = LABELS[kind];
  const number = index + 1;

  return (
    <section
      className={kind === "negative" ? "example-card example-card-negative" : "example-card"}
      aria-label={`example ${number}`}
    >
      <header className="example-card-head">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          onClick={() => onChange({ collapsed: !collapsed })}
        >
          <span className="chevron" aria-hidden="true">
            {collapsed ? "▶" : "▼"}
          </span>
          example {number}
        </button>

        <div className="kind-switch" role="group" aria-label={`example ${number} の種類`}>
          <button
            type="button"
            className={kind === "positive" ? "kind-option kind-option-on" : "kind-option"}
            aria-pressed={kind === "positive"}
            onClick={() => onChange({ kind: "positive" })}
          >
            良い例
          </button>
          <button
            type="button"
            className={kind === "negative" ? "kind-option kind-option-on" : "kind-option"}
            aria-pressed={kind === "negative"}
            onClick={() => onChange({ kind: "negative" })}
          >
            悪い例
          </button>
        </div>

        <div className="example-card-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`example ${number} を上へ移動`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`example ${number} を下へ移動`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`example ${number} を削除`}
            onClick={onDelete}
          >
            ✕
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="example-card-body">
          <AutoTextarea
            variant="onCard"
            label={labels.input}
            value={example.input}
            onChange={(input) => onChange({ input })}
          />
          <AutoTextarea
            variant="onCard"
            label={labels.middle}
            value={example.thinking}
            placeholder={kind === "negative" ? "なぜこの出力がダメなのか" : undefined}
            onChange={(thinking) => onChange({ thinking })}
          />
          <AutoTextarea
            variant="onCard"
            label={labels.output}
            value={example.idealOutput}
            placeholder={kind === "negative" ? "やってはいけない出力" : undefined}
            onChange={(idealOutput) => onChange({ idealOutput })}
          />
        </div>
      )}
    </section>
  );
}
