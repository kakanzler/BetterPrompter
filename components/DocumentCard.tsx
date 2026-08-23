"use client";

import AutoTextarea from "./AutoTextarea";
import type { DocumentEntry } from "@/lib/types";

type Props = {
  document: DocumentEntry;
  index: number;
  total: number;
  onChange: (patch: Partial<DocumentEntry>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

export default function DocumentCard({
  document,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: Props) {
  const collapsed = document.collapsed === true;
  const number = index + 1;

  return (
    <section className="document-card" aria-label={`document ${number}`}>
      <header className="document-card-head">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          onClick={() => onChange({ collapsed: !collapsed })}
        >
          <span className="chevron" aria-hidden="true">
            {collapsed ? "▶" : "▼"}
          </span>
          document {number}
        </button>

        <input
          className="source-input"
          value={document.source}
          placeholder="出典名（任意・例: report.md）"
          aria-label={`document ${number} の出典名`}
          onChange={(event) => onChange({ source: event.target.value })}
        />

        <div className="document-card-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`document ${number} を上へ移動`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`document ${number} を下へ移動`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`document ${number} を削除`}
            onClick={onDelete}
          >
            ✕
          </button>
        </div>
      </header>

      {!collapsed && (
        <AutoTextarea
          variant="onCard"
          label="<document_content>"
          value={document.content}
          rows={4}
          placeholder="モデルに読ませたい資料の本文"
          onChange={(content) => onChange({ content })}
        />
      )}
    </section>
  );
}
