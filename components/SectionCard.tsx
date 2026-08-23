"use client";

import type { ReactNode } from "react";
import type { SectionSpec } from "@/lib/sections";

type Props = {
  spec: SectionSpec;
  /** カードの見出しに出す名前。custom はタグ名を出したいので上書きできる。 */
  title?: string;
  collapsed: boolean;
  index: number;
  total: number;
  dragging: boolean;
  dropBefore: boolean;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  children: ReactNode;
};

export default function SectionCard({
  spec,
  title,
  collapsed,
  index,
  total,
  dragging,
  dropBefore,
  onToggleCollapse,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  children,
}: Props) {
  const label = title ?? spec.label;

  return (
    <section
      className={[
        "section-card",
        dragging ? "section-card-dragging" : "",
        dropBefore ? "section-card-drop" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      draggable
      onDragStart={(event) => {
        // Firefox はデータが無いとドラッグを開始しない。
        event.dataTransfer.setData("text/plain", label);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <header className="section-card-head">
        <span className="drag-handle" aria-hidden="true" title="ドラッグで並べ替え">
          ⠿
        </span>

        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          <span className="chevron" aria-hidden="true">
            {collapsed ? "▶" : "▼"}
          </span>
          <span className="section-card-title">{label}</span>
        </button>

        {!spec.ordered && spec.note && <span className="section-card-note">{spec.note}</span>}

        <div className="section-card-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} を上へ移動`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} を下へ移動`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`${label} を削除`}
            onClick={onDelete}
          >
            ✕
          </button>
        </div>
      </header>

      {!collapsed && <div className="section-card-body">{children}</div>}
    </section>
  );
}
