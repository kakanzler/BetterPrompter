"use client";

import { useState } from "react";
import ColorPicker from "./ColorPicker";
import GradientEditor from "./GradientEditor";
import StylePreview from "./StylePreview";
import { sanitizeTag } from "@/lib/buildPrompt";
import { clamp, hsvToRgb, rgbToHsv } from "@/lib/color";
import { cssVarName, styleTokenCssValue, styleTokenLine } from "@/lib/styleTokens";
import {
  emptyGradientStop,
  type Rgba,
  type StyleApply,
  type StyleOutputMode,
  type StyleToken,
  type StyleTokenType,
  type StyleTokenValue,
} from "@/lib/types";

type Props = {
  tokens: StyleToken[];
  tagName: string;
  outputMode: StyleOutputMode;
  newId: () => string;
  onUpdate: (id: string, patch: Partial<StyleToken>) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onChangeTagName: (name: string) => void;
  onChangeOutputMode: (mode: StyleOutputMode) => void;
};

const TYPES: { value: StyleTokenType; label: string }[] = [
  { value: "solid", label: "solid（単色）" },
  { value: "linear", label: "linear（線形）" },
  { value: "radial", label: "radial（放射）" },
];

const APPLIES: { value: StyleApply; label: string }[] = [
  { value: "color", label: "文字色 / color" },
  { value: "background", label: "背景 / background" },
  { value: "border-color", label: "枠線 / border-color" },
];

const MODES: { value: StyleOutputMode; label: string }[] = [
  { value: "customProperties", label: "カスタムプロパティ" },
  { value: "declarations", label: "CSS 宣言" },
];

const DEFAULT_ANGLE = 135;

/** グラデの2点目に置く、少し明るい変種。アルファは元のまま引き継ぐ。 */
function lighterVariant(color: Rgba): Rgba {
  const hsv = rgbToHsv(color);
  return {
    ...hsvToRgb({ h: hsv.h, s: clamp(hsv.s - 20, 0, 100), v: clamp(hsv.v + 25, 0, 100) }),
    a: color.a,
  };
}

/** そのトークンの代表色。グラデなら先頭停止点の色。 */
function firstColor(token: StyleToken): Rgba {
  const value = token.value;
  if ("color" in value) return value.color;
  const sorted = [...value.stops].sort((a, b) => a.position - b.position);
  return sorted[0]?.color ?? { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * type を切り替えたときの value。
 * 種類が変わっても「今見えている色」がなるべく残るように種を作る。
 */
export function convertValue(
  token: StyleToken,
  nextType: StyleTokenType,
  newId: () => string,
): StyleTokenValue {
  const value = token.value;
  if (nextType === "solid") return { color: firstColor(token) };

  // グラデ同士なら停止点をそのまま引き継ぎ、角度と形だけ入れ替える。
  const stops =
    "stops" in value && value.stops.length >= 2
      ? value.stops
      : [
          emptyGradientStop(newId(), 0, firstColor(token)),
          emptyGradientStop(newId(), 100, lighterVariant(firstColor(token))),
        ];

  if (nextType === "linear") {
    return { angle: "angle" in value ? value.angle : DEFAULT_ANGLE, stops };
  }
  return { shape: "shape" in value ? value.shape : "circle", stops };
}

type RowProps = {
  token: StyleToken;
  index: number;
  total: number;
  outputMode: StyleOutputMode;
  newId: () => string;
  onUpdate: (patch: Partial<StyleToken>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

function StyleTokenRow({
  token,
  index,
  total,
  outputMode,
  newId,
  onUpdate,
  onDelete,
  onMove,
}: RowProps) {
  // 「どの停止点の色を開いているか」は見え方だけの状態なので下書きには持たせない。
  const [openStopId, setOpenStopId] = useState<string | null>(null);

  const collapsed = token.collapsed === true;
  const number = index + 1;
  const varName = cssVarName(token.name);
  const label = varName || `style ${number}`;
  const line = styleTokenLine(token, outputMode);

  return (
    <section className="style-token-row" aria-label={label}>
      <header className="style-token-head">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          aria-label={`${label} を${collapsed ? "開く" : "折りたたむ"}`}
          onClick={() => onUpdate({ collapsed: !collapsed })}
        >
          <span className="chevron" aria-hidden="true">
            {collapsed ? "▶" : "▼"}
          </span>
          style {number}
        </button>

        <input
          className="style-name-input"
          value={token.name}
          placeholder="トークン名（例: brand primary）"
          spellCheck={false}
          aria-label={`style ${number} の名前`}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
        {varName && varName !== `--${token.name}` && (
          <span className="tag-hint">→ {varName}</span>
        )}

        <div className="style-token-actions">
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

      {!collapsed && (
        <div className="style-token-body">
          <div className="style-token-fields">
            <label className="style-field">
              <span className="style-field-label">種類</span>
              <select
                className="style-select"
                value={token.type}
                onChange={(event) => {
                  const type = event.target.value as StyleTokenType;
                  setOpenStopId(null);
                  onUpdate({ type, value: convertValue(token, type, newId) });
                }}
              >
                {TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="style-field">
              <span className="style-field-label">当て先</span>
              <select
                className="style-select"
                value={token.apply}
                onChange={(event) => onUpdate({ apply: event.target.value as StyleApply })}
              >
                {APPLIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="style-field style-field-wide">
              <span className="style-field-label">説明（任意）</span>
              <input
                className="style-input"
                value={token.description ?? ""}
                placeholder="出力に /* コメント */ として添えます"
                onChange={(event) => onUpdate({ description: event.target.value })}
              />
            </label>
          </div>

          {token.type === "solid" && "color" in token.value && (
            <ColorPicker
              value={token.value.color}
              onChange={(color) => onUpdate({ value: { color } })}
            />
          )}

          {token.type !== "solid" && "stops" in token.value && (
            <GradientEditor
              type={token.type === "radial" ? "radial" : "linear"}
              value={token.value}
              newId={newId}
              openStopId={openStopId}
              onOpenStop={setOpenStopId}
              onChange={(value) => onUpdate({ value })}
            />
          )}

          <StylePreview
            cssValue={styleTokenCssValue(token)}
            type={token.type}
            apply={token.apply}
          />
        </div>
      )}

      <code className="style-decl">{line ?? "（名前を入力）"}</code>
    </section>
  );
}

export default function StyleCard({
  tokens,
  tagName,
  outputMode,
  newId,
  onUpdate,
  onAdd,
  onDelete,
  onMove,
  onChangeTagName,
  onChangeOutputMode,
}: Props) {
  const sanitized = sanitizeTag(tagName) || "style_tokens";
  // 入力そのままでは XML に使えず書き換えられた場合だけ、実際に出るタグを見せる。
  const showsRewrite = sanitized !== tagName.trim();

  return (
    <div className="style-card">
      <div className="style-card-head">
        <span className="tag-editor">
          <span className="bracket" aria-hidden="true">
            &lt;
          </span>
          <input
            className="tag-input"
            style={{ width: `calc(${Math.min(Math.max(tagName.length + 1, 9), 28)}ch + 20px)` }}
            value={tagName}
            placeholder="style_tokens"
            spellCheck={false}
            aria-label="囲みタグ名"
            onChange={(event) => onChangeTagName(event.target.value)}
          />
          <span className="bracket" aria-hidden="true">
            &gt;
          </span>
        </span>

        {showsRewrite && <span className="tag-hint">→ &lt;{sanitized}&gt;</span>}

        <div className="kind-switch" role="group" aria-label="出力形式">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={["kind-option", outputMode === mode.value ? "kind-option-on" : ""]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={outputMode === mode.value}
              onClick={() => onChangeOutputMode(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {tokens.map((token, index) => (
        <StyleTokenRow
          key={token.id}
          token={token}
          index={index}
          total={tokens.length}
          outputMode={outputMode}
          newId={newId}
          onUpdate={(patch) => onUpdate(token.id, patch)}
          onDelete={() => onDelete(token.id)}
          onMove={(direction) => onMove(token.id, direction)}
        />
      ))}

      <button type="button" className="add-child" onClick={onAdd}>
        ＋ add style token
      </button>
    </div>
  );
}
