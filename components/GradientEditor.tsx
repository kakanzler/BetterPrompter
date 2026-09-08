"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import ColorPicker from "./ColorPicker";
import { clamp, rgbaToCss } from "@/lib/color";
import { serializeStops } from "@/lib/styleTokens";
import {
  emptyGradientStop,
  type GradientStop,
  type LinearValue,
  type RadialValue,
  type Rgba,
} from "@/lib/types";

type Props = {
  type: "linear" | "radial";
  value: LinearValue | RadialValue;
  newId: () => string;
  openStopId: string | null;
  onOpenStop: (id: string | null) => void;
  onChange: (value: LinearValue | RadialValue) => void;
};

/** 2色の中間色。バーの隙間に停止点を足すときの色。 */
function mixRgba(left: Rgba, right: Rgba, ratio: number): Rgba {
  const at = (a: number, b: number) => a + (b - a) * ratio;
  return {
    r: Math.round(at(left.r, right.r)),
    g: Math.round(at(left.g, right.g)),
    b: Math.round(at(left.b, right.b)),
    a: Math.round(at(left.a, right.a) * 1000) / 1000,
  };
}

/** 位置順に並べたとき、いちばん広い隙間の左側の添字。 */
function widestGapIndex(sorted: GradientStop[]): number {
  let best = 0;
  let bestGap = -1;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gap = sorted[index + 1].position - sorted[index].position;
    if (gap > bestGap) {
      bestGap = gap;
      best = index;
    }
  }
  return best;
}

export default function GradientEditor({
  type,
  value,
  newId,
  openStopId,
  onOpenStop,
  onChange,
}: Props) {
  const [dragStopId, setDragStopId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // ドラッグで終わったポインタ操作を「クリック」として拾わないための目印。
  const draggedRef = useRef(false);
  const angleId = useId();

  const stops = value.stops;
  const linear = type === "linear" && "angle" in value ? value : null;
  const radial = type === "radial" && "shape" in value ? value : null;

  // バーは位置をつかむための道具なので、角度・形に関わらず横方向で描く。
  // 実際の角度・形の見え方は StylePreview が受け持つ。
  const barBackground = `linear-gradient(to right, ${serializeStops(stops)})`;

  /** stops だけ差し替える。union のどちらの形かは保つ。 */
  function withStops(next: GradientStop[]): LinearValue | RadialValue {
    return linear ? { angle: linear.angle, stops: next } : { shape: radial?.shape ?? "circle", stops: next };
  }

  function patchStop(id: string, patch: Partial<GradientStop>) {
    onChange(withStops(stops.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop))));
  }

  function removeStop(id: string) {
    if (stops.length <= 2) return;
    if (openStopId === id) onOpenStop(null);
    onChange(withStops(stops.filter((stop) => stop.id !== id)));
  }

  /** いちばん広い隙間の真ん中へ、両隣を混ぜた色で停止点を足す。 */
  function addStop() {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    if (sorted.length < 2) return;
    const index = widestGapIndex(sorted);
    const left = sorted[index];
    const right = sorted[index + 1];
    const added = emptyGradientStop(
      newId(),
      Math.round((left.position + right.position) / 2),
      mixRgba(left.color, right.color, 0.5),
    );
    const next = [...sorted];
    next.splice(index + 1, 0, added);
    onChange(withStops(next));
    onOpenStop(added.id);
  }

  function positionFromEvent(event: ReactPointerEvent<HTMLElement>): number | null {
    const box = barRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return Math.round(clamp(((event.clientX - box.left) / box.width) * 100, 0, 100));
  }

  return (
    <div className="gradient-editor">
      <div className="gradient-controls">
        {linear && (
          <>
            <label className="gradient-caption" htmlFor={angleId}>
              角度
            </label>
            <input
              type="range"
              className="gradient-angle-range"
              min={0}
              max={360}
              step={1}
              value={Math.round(linear.angle)}
              aria-label="グラデーションの角度"
              onChange={(event) => onChange({ ...linear, angle: Number(event.target.value) })}
            />
            <input
              id={angleId}
              type="number"
              className="style-input style-input-narrow"
              min={0}
              max={360}
              step={1}
              value={Math.round(linear.angle)}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (Number.isFinite(parsed)) onChange({ ...linear, angle: clamp(parsed, 0, 360) });
              }}
            />
            <span className="gradient-unit">deg</span>
          </>
        )}

        {radial && (
          <>
            <label className="gradient-caption" htmlFor={angleId}>
              形
            </label>
            <select
              id={angleId}
              className="style-select"
              value={radial.shape}
              onChange={(event) =>
                onChange({
                  ...radial,
                  shape: event.target.value === "ellipse" ? "ellipse" : "circle",
                })
              }
            >
              <option value="circle">circle（円）</option>
              <option value="ellipse">ellipse（楕円）</option>
            </select>
          </>
        )}

        <span className="gradient-hint">バーをクリックで停止点を追加</span>
      </div>

      <div
        ref={barRef}
        className="gradient-bar"
        role="presentation"
        style={{ backgroundImage: barBackground }}
        onClick={addStop}
      >
        {stops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            className={["gradient-stop", openStopId === stop.id ? "gradient-stop-on" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${clamp(stop.position, 0, 100)}%`, background: rgbaToCss(stop.color) }}
            aria-label={`停止点 ${Math.round(stop.position)}% を動かす / 色を編集`}
            onClick={(event) => {
              // バーの「クリックで追加」を巻き込まない。ドラッグ直後は開閉しない。
              event.stopPropagation();
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              onOpenStop(openStopId === stop.id ? null : stop.id);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              draggedRef.current = false;
              setDragStopId(stop.id);
            }}
            onPointerMove={(event) => {
              if (dragStopId !== stop.id) return;
              const position = positionFromEvent(event);
              if (position === null || position === Math.round(stop.position)) return;
              draggedRef.current = true;
              patchStop(stop.id, { position });
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setDragStopId(null);
            }}
            onPointerCancel={() => setDragStopId(null)}
          />
        ))}
      </div>

      <ul className="gradient-stop-list">
        {stops.map((stop) => (
          <li key={stop.id} className="gradient-stop-item">
            <div className="gradient-stop-row">
              <input
                type="number"
                className="style-input style-input-narrow"
                min={0}
                max={100}
                step={1}
                value={Math.round(stop.position)}
                aria-label="停止点の位置（%）"
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (Number.isFinite(parsed)) patchStop(stop.id, { position: clamp(parsed, 0, 100) });
                }}
              />
              <span className="gradient-unit">%</span>

              <button
                type="button"
                className="gradient-swatch"
                style={{ background: rgbaToCss(stop.color) }}
                aria-expanded={openStopId === stop.id}
                aria-label="この停止点の色を編集"
                onClick={() => onOpenStop(openStopId === stop.id ? null : stop.id)}
              />
              <code className="gradient-stop-value">{rgbaToCss(stop.color)}</code>

              <button
                type="button"
                className="icon-button icon-button-danger"
                disabled={stops.length <= 2}
                aria-label="この停止点を削除"
                onClick={() => removeStop(stop.id)}
              >
                ✕
              </button>
            </div>

            {openStopId === stop.id && (
              <ColorPicker value={stop.color} onChange={(color) => patchStop(stop.id, { color })} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
