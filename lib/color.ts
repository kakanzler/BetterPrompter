import type { Rgba } from "./types";

/** 色相 0–360、彩度・明度 0–100。 */
export type Hsv = { h: number; s: number; v: number };

/** 範囲に収める。NaN の面倒は呼び出し側（normalizeRgba / clampNumber）が見る。 */
export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** 0–255 の整数に丸める。 */
function toByte(n: number): number {
  return Math.round(clamp(n, 0, 255));
}

/** 2桁の小文字16進。 */
function hex2(n: number): string {
  return toByte(n).toString(16).padStart(2, "0");
}

export function rgbToHsv(rgb: { r: number; g: number; b: number }): Hsv {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  // 無彩色は色相が定まらないので 0 に倒す（UI 側が前の色相を保持する）。
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

export function hsvToRgb(hsv: Hsv): { r: number; g: number; b: number } {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** 不透明なら #rrggbb、半透明なら #rrggbbaa（いずれも小文字）。 */
export function rgbaToHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  const a = clamp(c.a, 0, 1);
  return a >= 1 ? base : `${base}${hex2(a * 255)}`;
}

/** 16進1桁を2桁へ広げる（"f" → "ff"）。 */
function expand(part: string): number {
  return parseInt(part + part, 16);
}

/** 小数の桁が増えすぎないように 3桁で丸める。 */
function roundAlpha(a: number): number {
  return Math.round(a * 1000) / 1000;
}

/** #rgb / #rgba / #rrggbb / #rrggbbaa。`#` は省略可。不正なら null。 */
export function parseHex(input: string): Rgba | null {
  const body = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(body)) return null;

  if (body.length === 3 || body.length === 4) {
    return {
      r: expand(body[0]),
      g: expand(body[1]),
      b: expand(body[2]),
      a: body.length === 4 ? roundAlpha(expand(body[3]) / 255) : 1,
    };
  }
  if (body.length === 6 || body.length === 8) {
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
      a: body.length === 8 ? roundAlpha(parseInt(body.slice(6, 8), 16) / 255) : 1,
    };
  }
  return null;
}

/**
 * CSS に埋める色。不透明なら #rrggbb、半透明なら rgba(...)。
 * 8桁 hex より rgba() のほうが読み手にも古い環境にも通りやすい。
 */
export function rgbaToCss(c: Rgba): string {
  const a = clamp(c.a, 0, 1);
  if (a >= 1) return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return `rgba(${toByte(c.r)}, ${toByte(c.g)}, ${toByte(c.b)}, ${formatAlpha(a)})`;
}

/** rgb() / rgba() の文字列。区切りの空白・カンマ・スラッシュに寛容。 */
export function parseRgbaString(input: string): Rgba | null {
  const match = input.trim().match(/^rgba?\s*\(([^)]*)\)$/i);
  if (!match) return null;

  const parts = match[1]
    .split(/[\s,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  if (parts.some((part) => !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(part))) return null;

  const [r, g, b, a] = parts.map(Number);
  return {
    r: toByte(r),
    g: toByte(g),
    b: toByte(b),
    a: parts.length === 4 ? roundAlpha(clamp(a, 0, 1)) : 1,
  };
}

/** 0–1 のアルファを最大3桁で表記する（末尾の 0 は落とす）。 */
export function formatAlpha(a: number): string {
  const value = clamp(a, 0, 1);
  return String(Math.round(value * 1000) / 1000);
}

/** 相対輝度から、その色を背景にしたときの読める文字色を返す。 */
export function contrastText(c: Rgba): "#000000" | "#ffffff" {
  const channel = (n: number) => {
    const v = clamp(n, 0, 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/** 数値として使える値だけ拾う。 */
function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 外から来た値を Rgba に整える。不明なら不透明の黒、範囲外はクランプ。 */
export function normalizeRgba(value: unknown): Rgba {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    r: toByte(asNumber(raw.r, 0)),
    g: toByte(asNumber(raw.g, 0)),
    b: toByte(asNumber(raw.b, 0)),
    a: clamp(asNumber(raw.a, 1), 0, 1),
  };
}
