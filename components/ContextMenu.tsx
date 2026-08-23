"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SECTION_SPECS, type SectionSpec } from "@/lib/sections";
import type { SectionKind } from "@/lib/types";

export type MenuPosition = { x: number; y: number };

type Props = {
  position: MenuPosition;
  /** 追加できない（既に1枚ある）種類。 */
  disabledKinds: Set<SectionKind>;
  /** recommend でまだ足せるカードがあるか。 */
  recommendAvailable: boolean;
  onAdd: (kind: SectionKind) => void;
  onRecommend: () => void;
  onClose: () => void;
};

const MENU_WIDTH = 275;
/** 画面端からこれ以上は近づけない。 */
const EDGE_GAP = 12;

function matches(spec: SectionSpec, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    spec.label.toLowerCase().includes(needle) ||
    spec.hint.toLowerCase().includes(needle) ||
    spec.kind.toLowerCase().includes(needle)
  );
}

export default function ContextMenu({
  position,
  disabledKinds,
  recommendAvailable,
  onAdd,
  onRecommend,
  onClose,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // 実際の高さが測れるまでは仮の位置で描き、測れてから画面内へ寄せる。
  const [clamped, setClamped] = useState<MenuPosition>(position);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const height = element.offsetHeight;
    setClamped({
      x: Math.min(position.x, window.innerWidth - MENU_WIDTH - EDGE_GAP),
      y: Math.min(position.y, Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP)),
    });
  }, [position]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // capture で拾わないと、閉じる前に下の要素がクリックを受けてしまう。
    window.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [onClose]);

  const visible = useMemo(
    () => SECTION_SPECS.filter((spec) => matches(spec, query)),
    [query],
  );
  const showRecommend =
    recommendAvailable && "recommend おすすめ".includes(query.trim().toLowerCase());

  return (
    <aside
      ref={ref}
      className="neon-menu"
      style={{ left: clamped.x, top: clamped.y }}
      role="menu"
      aria-label="カードを追加"
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="shine shine-top" aria-hidden="true" />
      <span className="shine shine-bottom" aria-hidden="true" />
      <span className="glow glow-top" aria-hidden="true" />
      <span className="glow glow-bottom" aria-hidden="true" />

      <div className="neon-inner">
        <div className="neon-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            placeholder="type a command or search"
            aria-label="カードを絞り込む"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {showRecommend && (
          <>
            <p className="neon-group">Suggestions</p>
            <button
              type="button"
              className="neon-item neon-item-accent"
              role="menuitem"
              onClick={() => {
                onRecommend();
                onClose();
              }}
            >
              <span className="neon-glyph" aria-hidden="true">
                ✦
              </span>
              <span className="neon-text">
                recommend
                <span className="neon-hint">おすすめの構成を一度に揃える</span>
              </span>
            </button>
          </>
        )}

        {visible.length > 0 && <p className="neon-group">Cards</p>}

        {visible.map((spec) => {
          const disabled = disabledKinds.has(spec.kind);
          return (
            <button
              key={spec.kind}
              type="button"
              className="neon-item"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                onAdd(spec.kind);
                onClose();
              }}
            >
              <span className="neon-glyph" aria-hidden="true">
                {spec.glyph}
              </span>
              <span className="neon-text">
                {spec.label}
                <span className="neon-hint">{disabled ? "すでにあります" : spec.hint}</span>
              </span>
            </button>
          );
        })}

        {visible.length === 0 && !showRecommend && (
          <p className="neon-empty">該当なし</p>
        )}
      </div>
    </aside>
  );
}
