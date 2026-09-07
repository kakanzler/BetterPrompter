import { rgbaToCss } from "./color";
import type { GradientStop, StyleOutputMode, StyleToken } from "./types";

/** 停止点が1つも無い壊れたグラデの逃げ場。 */
const EMPTY_COLOR = rgbaToCss({ r: 0, g: 0, b: 0, a: 0 });

/**
 * トークン名を CSS カスタムプロパティ名へ整える（"Brand Primary" → "--brand-primary"）。
 * 使える文字が残らなければ空文字列を返し、呼び出し側がその行ごと落とす。
 */
export function cssVarName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "";
  // 数字始まりでも CSS 的には通るが、識別子として読みやすいので _ を前置する。
  return `--${/^[0-9]/.test(slug) ? `_${slug}` : slug}`;
}

/** グラデーションの色停止点を position 順に並べて CSS の並びにする。 */
export function serializeStops(stops: GradientStop[]): string {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${rgbaToCss(stop.color)} ${Math.round(stop.position)}%`)
    .join(", ");
}

/** 停止点が2点未満だとグラデにならないので、先頭停止点の単色へ落とす。 */
function gradientCss(fn: string, head: string, stops: GradientStop[]): string {
  if (stops.length === 0) return EMPTY_COLOR;
  if (stops.length === 1) return rgbaToCss(stops[0].color);
  return `${fn}(${head}, ${serializeStops(stops)})`;
}

/**
 * トークン1つの CSS 値。プレビューと buildPrompt が共用するので、
 * 見た目と出力が食い違うことがない。
 */
export function styleTokenCssValue(token: StyleToken): string {
  const value = token.value;
  if (token.type === "solid" && "color" in value) return rgbaToCss(value.color);
  if (token.type === "linear" && "angle" in value) {
    return gradientCss("linear-gradient", `${Math.round(value.angle)}deg`, value.stops);
  }
  if (token.type === "radial" && "shape" in value) {
    return gradientCss("radial-gradient", value.shape, value.stops);
  }
  // type と value の形が食い違う壊れたデータ。正規化を通っていれば来ない。
  return EMPTY_COLOR;
}

/**
 * トークン1つが出す CSS の行。名前が使えなければ null（＝その行は出さない）。
 * description があれば CSS コメントを1行前置する。コメントに載せる名前は
 * `--` を外した識別子（[a-z0-9-] のみ）にして、コメントが途中で閉じる事故を構造的に防ぐ。
 */
export function styleTokenLine(token: StyleToken, mode: StyleOutputMode): string | null {
  const varName = cssVarName(token.name);
  if (!varName) return null;

  const value = styleTokenCssValue(token);
  const declaration =
    mode === "declarations" ? `${token.apply}: ${value};` : `${varName}: ${value};`;

  const description = (token.description ?? "").replace(/\s+/g, " ").replace(/\*\//g, "").trim();
  if (!description) return declaration;
  return `/* ${varName.slice(2)} — ${description} */\n${declaration}`;
}

/** 使えるトークンの行をつなげた CSS。1行も出なければ空文字列。 */
export function buildStyleCss(tokens: StyleToken[], mode: StyleOutputMode): string {
  return tokens
    .map((token) => styleTokenLine(token, mode))
    .filter((line): line is string => line !== null)
    .join("\n");
}
