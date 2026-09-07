"use client";

import type { CSSProperties } from "react";
import { contrastText, parseHex, parseRgbaString } from "@/lib/color";
import type { StyleApply, StyleTokenType } from "@/lib/types";

type Props = {
  cssValue: string;
  type: StyleTokenType;
  apply: StyleApply;
};

const HEADING = "見出しのサンプル / Heading";
const BODY =
  "本文のサンプルです。日本語と Latin の混ざった行で、選んだ色がどう読めるかを確かめられます。";

export default function StylePreview({ cssValue, type, apply }: Props) {
  const gradient = type !== "solid";

  // グラデは文字色に直接使えないので、背景をテキストで切り抜く。
  const textStyle: CSSProperties = gradient
    ? {
        backgroundImage: cssValue,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
      }
    : { color: cssValue };

  // 単色なら輝度から読める文字色を決める。グラデは白に倒す。
  const solid = gradient ? null : parseHex(cssValue) ?? parseRgbaString(cssValue);
  const buttonText = solid ? contrastText(solid) : "#ffffff";

  function surfaceClass(target: StyleApply): string {
    return ["style-preview-surface", apply === target ? "style-preview-surface-active" : ""]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div className="style-preview">
      <div className="style-preview-panel">
        <div className={surfaceClass("color")}>
          <span className="style-preview-caption">文字色</span>
          <div className="style-preview-text">
            <h4 style={apply === "color" ? textStyle : undefined}>{HEADING}</h4>
            <p style={apply === "color" ? textStyle : undefined}>{BODY}</p>
          </div>
        </div>

        <div className={surfaceClass("background")}>
          <span className="style-preview-caption">塗り</span>
          <div className="style-preview-box style-preview-fill" style={{ background: cssValue }} />
        </div>

        <div className={surfaceClass("background")}>
          <span className="style-preview-caption">ボタン</span>
          <button
            type="button"
            className="style-preview-button"
            style={{ background: cssValue, color: buttonText }}
            onClick={(event) => event.preventDefault()}
          >
            ボタン / Button
          </button>
        </div>

        <div className={surfaceClass("border-color")}>
          <span className="style-preview-caption">枠線</span>
          <div
            className="style-preview-box style-preview-border"
            // グラデは border に直接置けないので、3px の余白を敷いた枠で代用する。
            style={gradient ? { background: cssValue, padding: 3 } : { border: `3px solid ${cssValue}` }}
          >
            <div className="style-preview-border-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
