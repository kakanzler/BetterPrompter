"use client";

import { useState, type ReactNode } from "react";
import type { SectionSpec } from "@/lib/sections";

export type DropPosition = "before" | "after";

type Props = {
  spec: SectionSpec;
  /** カードの見出しに出す名前。custom はタグ名を出したいので上書きできる。 */
  title?: string;
  collapsed: boolean;
  index: number;
  total: number;
  dragging: boolean;
  /** ドロップ先の目印を上下どちらに出すか。対象でなければ null。 */
  dropPosition: DropPosition | null;
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
  dropPosition,
  onToggleCollapse,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  children,
}: Props) {
  /**
   * ハンドルを掴んでいる間だけ draggable にする。
   * カード全体を常に draggable にすると、配下の input / textarea で
   * マウスによるテキスト選択ができなくなる。
   */
  const [grabbed, setGrabbed] = useState(false);
  const label = title ?? spec.label;

  return (
    <section
      className={[
        "section-card",
        dragging ? "section-card-dragging" : "",
        dropPosition ? `section-card-drop-${dropPosition}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      draggable={grabbed}
      onDragStart={(event) => {
        // Firefox はデータが無いとドラッグを開始しない。
        event.dataTransfer.setData("text/plain", label);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        setGrabbed(false);
        onDragEnd();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        setGrabbed(false);
        onDrop();
      }}
    >
      <header className="section-card-head">
        <span
          className="drag-handle"
          title="ドラッグで並べ替え"
          aria-hidden="true"
          onMouseDown={() => setGrabbed(true)}
          onMouseUp={() => setGrabbed(false)}
        >
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
