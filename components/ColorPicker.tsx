"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clamp,
  formatAlpha,
  hsvToRgb,
  parseHex,
  rgbToHsv,
  rgbaToCss,
  rgbaToHex,
} from "@/lib/color";
import type { Rgba } from "@/lib/types";

type Props = {
  value: Rgba;
  onChange: (value: Rgba) => void;
};

/** 数値入力は打ちかけの文字列を持つ必要があるので、確定するまで生の文字列で預かる。 */
type Drafts = Partial<Record<"hex" | "r" | "g" | "b" | "a", string>>;

/** アルファ帯の下に敷く市松。透けているかを目で見えるようにする。 */
const CHECKER =
  "conic-gradient(hsl(var(--hue2) 14% 26%) 0 25%, hsl(var(--hue2) 14% 16%) 0 50%," +
  " hsl(var(--hue2) 14% 26%) 0 75%, hsl(var(--hue2) 14% 16%) 0)";

/**
 * このコンポーネントは props の value をそのまま映す制御コンポーネント。
 * 状態は「打ちかけの数値文字列」と「ドラッグ中か」だけで、色そのものは持たない。
 * 唯一 hueRef だけは、彩度や明度が 0 になって色相が失われたときに
 * スライダーが赤へ飛ばないよう、最後に見えていた色相を覚えておくためのもの。
 */
export default function ColorPicker({ value, onChange }: Props) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [dragging, setDragging] = useState(false);
  const svRef = useRef<HTMLDivElement>(null);

  const derived = rgbToHsv(value);
  // 最後に見えていた有彩色の色相。無彩色に落ちてもスライダーが赤へ飛ばないための控え。
  const hueRef = useRef(derived.s > 0 && derived.v > 0 ? derived.h : 0);
  // レンダー中の ref 更新は「直前に見た値のキャッシュ」用途なので安全（setState ではない）。
  if (derived.s > 0 && derived.v > 0) hueRef.current = derived.h;
  const hue = Math.round(hueRef.current);

  const alpha = clamp(value.a, 0, 1);
  const hex = rgbaToHex(value);

  /** すべての操作はここを通って親へ返すだけ。ローカルに色を溜めない。 */
  function emit(rgba: Rgba) {
    const next: Rgba = {
      r: Math.round(clamp(rgba.r, 0, 255)),
      g: Math.round(clamp(rgba.g, 0, 255)),
      b: Math.round(clamp(rgba.b, 0, 255)),
      a: clamp(rgba.a, 0, 1),
    };
    const hsv = rgbToHsv(next);
    if (hsv.s > 0 && hsv.v > 0) hueRef.current = hsv.h;
    onChange(next);
  }

  /** hue / s / v から色を作って返す。色相は引数優先、無ければ覚えた値。 */
  function emitHsv(partial: { h?: number; s?: number; v?: number }, nextAlpha = alpha) {
    const h = partial.h ?? hueRef.current;
    const s = partial.s ?? derived.s;
    const v = partial.v ?? derived.v;
    if (partial.h !== undefined) hueRef.current = partial.h;
    emit({ ...hsvToRgb({ h, s, v }), a: nextAlpha });
  }

  function applyPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const box = svRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const s = clamp(((event.clientX - box.left) / box.width) * 100, 0, 100);
    const v = clamp((1 - (event.clientY - box.top) / box.height) * 100, 0, 100);
    emitHsv({ h: hueRef.current, s, v });
  }

  /** 数値欄の入力。読めない値は state に溜めるだけで emit しない（blur で戻す）。 */
  function changeChannel(key: "r" | "g" | "b" | "a", raw: string) {
    setDrafts((previous) => ({ ...previous, [key]: raw }));
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    if (key === "a") emit({ ...value, a: clamp(parsed, 0, 1) });
    else emit({ ...value, [key]: Math.round(clamp(parsed, 0, 255)) });
  }

  function changeHex(raw: string) {
    setDrafts((previous) => ({ ...previous, hex: raw }));
    const parsed = parseHex(raw);
    if (parsed) emit(parsed);
  }

  /** 打ちかけの文字列を捨てて、確定値の表示へ戻す。 */
  function resetDraft(key: keyof Drafts) {
    setDrafts((previous) => {
      if (previous[key] === undefined) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  const channels: { key: "r" | "g" | "b" | "a"; label: string; max: number; step: number }[] = [
    { key: "r", label: "R", max: 255, step: 1 },
    { key: "g", label: "G", max: 255, step: 1 },
    { key: "b", label: "B", max: 255, step: 1 },
    { key: "a", label: "A", max: 1, step: 0.01 },
  ];

  const opaque = rgbaToCss({ r: value.r, g: value.g, b: value.b, a: 1 });

  return (
    <div className="color-picker">
      <div
        ref={svRef}
        className={["cp-sv", dragging ? "cp-sv-dragging" : ""].filter(Boolean).join(" ")}
        role="presentation"
        aria-label="彩度と明度"
        style={{
          backgroundImage:
            "linear-gradient(to top, #000, transparent)," +
            ` linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          applyPointer(event);
        }}
        onPointerMove={(event) => {
          if (dragging) applyPointer(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <span
          className="cp-thumb"
          aria-hidden="true"
          style={{
            left: `${clamp(derived.s, 0, 100)}%`,
            top: `${100 - clamp(derived.v, 0, 100)}%`,
            background: opaque,
          }}
        />
      </div>

      <div className="cp-sliders">
        <input
          type="range"
          className="cp-hue"
          min={0}
          max={360}
          step={1}
          value={hue}
          aria-label="色相"
          onChange={(event) => emitHsv({ h: Number(event.target.value) })}
        />
        <input
          type="range"
          className="cp-alpha"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          aria-label="不透明度"
          style={{
            backgroundImage:
              `linear-gradient(to right, ${rgbaToCss({ ...value, a: 0 })},` +
              ` ${opaque}), ${CHECKER}`,
            backgroundSize: "100% 100%, 10px 10px",
          }}
          onChange={(event) => emit({ ...value, a: clamp(Number(event.target.value), 0, 1) })}
        />
      </div>

      <div className="cp-fields">
        <label className="cp-field cp-field-hex">
          <span className="cp-field-label">hex</span>
          <input
            className="style-input"
            type="text"
            spellCheck={false}
            value={drafts.hex ?? hex}
            onChange={(event) => changeHex(event.target.value)}
            onBlur={() => resetDraft("hex")}
          />
        </label>

        {channels.map((channel) => (
          <label key={channel.key} className="cp-field">
            <span className="cp-field-label">{channel.label}</span>
            <input
              className="style-input"
              type="number"
              min={0}
              max={channel.max}
              step={channel.step}
              value={
                drafts[channel.key] ??
                (channel.key === "a" ? formatAlpha(alpha) : String(value[channel.key]))
              }
              onChange={(event) => changeChannel(channel.key, event.target.value)}
              onBlur={() => resetDraft(channel.key)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
