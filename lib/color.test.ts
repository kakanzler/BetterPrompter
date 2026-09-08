import { describe, expect, it } from "vitest";
import {
  clamp,
  contrastText,
  formatAlpha,
  hsvToRgb,
  normalizeRgba,
  parseHex,
  parseRgbaString,
  rgbaToCss,
  rgbaToHex,
  rgbToHsv,
} from "./color";

describe("clamp", () => {
  it("範囲外を両端へ寄せる", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe("rgbToHsv / hsvToRgb の往復", () => {
  const samples: Array<[string, { r: number; g: number; b: number }]> = [
    ["赤", { r: 255, g: 0, b: 0 }],
    ["緑", { r: 0, g: 255, b: 0 }],
    ["青", { r: 0, g: 0, b: 255 }],
    ["白", { r: 255, g: 255, b: 255 }],
    ["黒", { r: 0, g: 0, b: 0 }],
    ["灰", { r: 128, g: 128, b: 128 }],
    ["朱", { r: 255, g: 87, b: 51 }],
    ["空", { r: 51, g: 193, b: 255 }],
  ];

  for (const [label, rgb] of samples) {
    it(`${label}は往復しても ±1 に収まる`, () => {
      const back = hsvToRgb(rgbToHsv(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    });
  }

  it("赤の色相は 0、彩度・明度は 100", () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 });
  });

  it("無彩色の色相は 0 に倒す", () => {
    expect(rgbToHsv({ r: 128, g: 128, b: 128 }).s).toBe(0);
    expect(rgbToHsv({ r: 128, g: 128, b: 128 }).h).toBe(0);
  });

  it("hsvToRgb は整数を返す", () => {
    const rgb = hsvToRgb({ h: 200, s: 63, v: 77 });
    expect(Number.isInteger(rgb.r)).toBe(true);
    expect(Number.isInteger(rgb.g)).toBe(true);
    expect(Number.isInteger(rgb.b)).toBe(true);
  });

  it("色相 360 は 0 と同じ色になる", () => {
    expect(hsvToRgb({ h: 360, s: 100, v: 100 })).toEqual(hsvToRgb({ h: 0, s: 100, v: 100 }));
  });
});

describe("parseHex", () => {
  it("3桁は各桁を2倍にして読む", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("6桁を読む", () => {
    expect(parseHex("#abc123")).toEqual({ r: 171, g: 193, b: 35, a: 1 });
  });

  it("# は省略できる", () => {
    expect(parseHex("ff5733")).toEqual({ r: 255, g: 87, b: 51, a: 1 });
  });

  it("8桁はアルファ付き", () => {
    expect(parseHex("#ffffffff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex("#ff573380")?.a).toBeCloseTo(0.502, 3);
  });

  it("4桁もアルファ付き", () => {
    const parsed = parseHex("#f00a");
    expect(parsed?.r).toBe(255);
    expect(parsed?.g).toBe(0);
    expect(parsed?.a).toBeCloseTo(0.667, 3);
  });

  it("不正な入力は null", () => {
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("こんにちは")).toBeNull();
    expect(parseHex("#gggggg")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("rgbaToHex", () => {
  it("不透明なら6桁の小文字", () => {
    expect(rgbaToHex({ r: 255, g: 87, b: 51, a: 1 })).toBe("#ff5733");
  });

  it("半透明なら8桁", () => {
    expect(rgbaToHex({ r: 255, g: 87, b: 51, a: 0.5 })).toBe("#ff573380");
  });

  it("小数の成分は丸める", () => {
    expect(rgbaToHex({ r: 254.6, g: 0.4, b: 51, a: 1 })).toBe("#ff0033");
  });

  it("parseHex と往復する", () => {
    expect(rgbaToHex(parseHex("#33c1ff")!)).toBe("#33c1ff");
  });
});

describe("rgbaToCss", () => {
  it("不透明は hex", () => {
    expect(rgbaToCss({ r: 255, g: 87, b: 51, a: 1 })).toBe("#ff5733");
  });

  it("半透明は rgba()", () => {
    expect(rgbaToCss({ r: 51, g: 193, b: 255, a: 0.5 })).toBe("rgba(51, 193, 255, 0.5)");
  });

  it("完全に透明でも rgba()", () => {
    expect(rgbaToCss({ r: 0, g: 0, b: 0, a: 0 })).toBe("rgba(0, 0, 0, 0)");
  });
});

describe("parseRgbaString", () => {
  it("rgb() を読む", () => {
    expect(parseRgbaString("rgb(255, 87, 51)")).toEqual({ r: 255, g: 87, b: 51, a: 1 });
  });

  it("rgba() を読む", () => {
    expect(parseRgbaString("rgba(51,193,255,0.5)")).toEqual({ r: 51, g: 193, b: 255, a: 0.5 });
  });

  it("空白の揺れに寛容", () => {
    expect(parseRgbaString("  RGBA( 51 193 255 / 0.25 )  ")).toEqual({
      r: 51,
      g: 193,
      b: 255,
      a: 0.25,
    });
  });

  it("成分が足りない・数値でないものは null", () => {
    expect(parseRgbaString("rgb(255, 87)")).toBeNull();
    expect(parseRgbaString("rgb(red, green, blue)")).toBeNull();
    expect(parseRgbaString("#ff5733")).toBeNull();
  });
});

describe("formatAlpha", () => {
  it("整数の端は 0 / 1", () => {
    expect(formatAlpha(1)).toBe("1");
    expect(formatAlpha(0)).toBe("0");
  });

  it("末尾の 0 は落とす", () => {
    expect(formatAlpha(0.5)).toBe("0.5");
    expect(formatAlpha(0.375)).toBe("0.375");
  });

  it("3桁を超える分は丸める", () => {
    expect(formatAlpha(0.3751)).toBe("0.375");
  });
});

describe("normalizeRgba", () => {
  it("不明な値は不透明の黒", () => {
    expect(normalizeRgba(undefined)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(normalizeRgba("#ff5733")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(normalizeRgba(null)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("範囲外はクランプする", () => {
    expect(normalizeRgba({ r: 999, g: -20, b: 51, a: 5 })).toEqual({ r: 255, g: 0, b: 51, a: 1 });
  });

  it("小数の成分は整数に丸める", () => {
    expect(normalizeRgba({ r: 12.7, g: 0, b: 0, a: 0.5 })).toEqual({ r: 13, g: 0, b: 0, a: 0.5 });
  });

  it("自分の出力を再正規化しても変わらない", () => {
    const once = normalizeRgba({ r: 999, g: -20, b: 51.4, a: 0.5 });
    expect(normalizeRgba(once)).toEqual(once);
  });
});

describe("contrastText", () => {
  it("明るい背景には黒文字", () => {
    expect(contrastText({ r: 255, g: 255, b: 255, a: 1 })).toBe("#000000");
  });

  it("暗い背景には白文字", () => {
    expect(contrastText({ r: 0, g: 0, b: 0, a: 1 })).toBe("#ffffff");
    expect(contrastText({ r: 255, g: 87, b: 51, a: 1 })).toBe("#ffffff");
  });
});
