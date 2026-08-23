"use client";

import AutoTextarea from "./AutoTextarea";
import type { Example } from "@/lib/types";

type Props = {
  example: Example;
  index: number;
  total: number;
  onChange: (patch: Partial<Example>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

export default function ExampleCard({ example, index, total, onChange, onDelete, onMove }: Props) {
  const collapsed = example.collapsed === true;
  const number = index + 1;

  return (
    <section className="example-card" aria-label={`example ${number}`}>
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
            label="<input>"
            value={example.input}
            onChange={(input) => onChange({ input })}
          />
          <AutoTextarea
            variant="onCard"
            label="<thinking>"
            value={example.thinking}
            onChange={(thinking) => onChange({ thinking })}
          />
          <AutoTextarea
            variant="onCard"
            label="<ideal output>"
            value={example.idealOutput}
            onChange={(idealOutput) => onChange({ idealOutput })}
          />
        </div>
      )}
    </section>
  );
}
