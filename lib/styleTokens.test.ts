import { describe, expect, it } from "vitest";
import { buildStyleCss, cssVarName, serializeStops, styleTokenCssValue, styleTokenLine } from "./styleTokens";
import { emptyStyleToken } from "./types";
import type { GradientStop, Rgba, StyleToken } from "./types";

const ORANGE: Rgba = { r: 255, g: 87, b: 51, a: 1 };
const SKY: Rgba = { r: 51, g: 193, b: 255, a: 1 };

function stop(id: string, position: number, color: Rgba): GradientStop {
  return { id, position, color };
}

/** solid の朱色トークン。 */
function solid(name: string, color: Rgba = ORANGE, extra: Partial<StyleToken> = {}): StyleToken {
  return { ...emptyStyleToken("t"), name, type: "solid", value: { color }, ...extra };
}

describe("cssVarName", () => {
  it("空白区切りの名前をケバブケースにする", () => {
    expect(cssVarName("Brand Primary")).toBe("--brand-primary");
  });

  it("アンダースコアもハイフンに寄せる", () => {
    expect(cssVarName("brand_primary")).toBe("--brand-primary");
  });

  it("使えない文字を落とし、連続ハイフンを潰す", () => {
    expect(cssVarName("  Brand@@ // Primary ")).toBe("--brand-primary");
  });

  it("数字始まりには _ を前置する", () => {
    expect(cssVarName("1st color")).toBe("--_1st-color");
  });

  it("使える文字が無ければ空文字列", () => {
    expect(cssVarName("@@@")).toBe("");
    expect(cssVarName("")).toBe("");
    expect(cssVarName("背景色")).toBe("");
  });
});

describe("serializeStops", () => {
  it("position 順に並べ替えて連結する", () => {
    const stops = [stop("b", 100, SKY), stop("a", 0, ORANGE)];
    expect(serializeStops(stops)).toBe("#ff5733 0%, #33c1ff 100%");
  });

  it("% の前に空白を入れない", () => {
    expect(serializeStops([stop("a", 50, ORANGE)])).toBe("#ff5733 50%");
  });

  it("半透明の停止点は rgba() で書く", () => {
    expect(serializeStops([stop("a", 0, { ...ORANGE, a: 0.5 })])).toBe("rgba(255, 87, 51, 0.5) 0%");
  });
});

describe("styleTokenCssValue", () => {
  it("solid は単色", () => {
    expect(styleTokenCssValue(solid("brand"))).toBe("#ff5733");
  });

  it("solid の半透明は rgba()", () => {
    expect(styleTokenCssValue(solid("brand", { ...ORANGE, a: 0.5 }))).toBe(
      "rgba(255, 87, 51, 0.5)",
    );
  });

  it("linear は角度と停止点から組み立てる", () => {
    const token: StyleToken = {
      ...emptyStyleToken("t"),
      name: "brand",
      type: "linear",
      value: { angle: 135, stops: [stop("a", 0, ORANGE), stop("b", 100, SKY)] },
    };
    expect(styleTokenCssValue(token)).toBe("linear-gradient(135deg, #ff5733 0%, #33c1ff 100%)");
  });

  it("角度は整数に丸める", () => {
    const token: StyleToken = {
      ...emptyStyleToken("t"),
      name: "brand",
      type: "linear",
      value: { angle: 135.4, stops: [stop("a", 0, ORANGE), stop("b", 100, SKY)] },
    };
    expect(styleTokenCssValue(token)).toContain("135deg");
  });

  it("radial は形と停止点から組み立てる", () => {
    const token: StyleToken = {
      ...emptyStyleToken("t"),
      name: "brand",
      type: "radial",
      value: { shape: "ellipse", stops: [stop("a", 0, ORANGE), stop("b", 100, SKY)] },
    };
    expect(styleTokenCssValue(token)).toBe("radial-gradient(ellipse, #ff5733 0%, #33c1ff 100%)");
  });

  it("停止点が1つのグラデは単色へ落とす", () => {
    const token: StyleToken = {
      ...emptyStyleToken("t"),
      name: "brand",
      type: "linear",
      value: { angle: 90, stops: [stop("a", 0, SKY)] },
    };
    expect(styleTokenCssValue(token)).toBe("#33c1ff");
  });
});

describe("styleTokenLine", () => {
  it("customProperties はカスタムプロパティ宣言", () => {
    expect(styleTokenLine(solid("Brand Primary"), "customProperties")).toBe(
      "--brand-primary: #ff5733;",
    );
  });

  it("declarations は apply のプロパティ宣言", () => {
    expect(styleTokenLine(solid("Brand Primary"), "declarations")).toBe("background: #ff5733;");
  });

  it("apply を変えると宣言のプロパティも変わる", () => {
    const token = solid("Brand Primary", ORANGE, { apply: "color" });
    expect(styleTokenLine(token, "declarations")).toBe("color: #ff5733;");
    // カスタムプロパティ側は apply の影響を受けない。
    expect(styleTokenLine(token, "customProperties")).toBe("--brand-primary: #ff5733;");
  });

  it("名前が使えなければ null", () => {
    expect(styleTokenLine(solid(""), "customProperties")).toBeNull();
    expect(styleTokenLine(solid("@@@"), "declarations")).toBeNull();
  });

  it("description は CSS コメントで前置する", () => {
    const token = solid("Brand Primary", ORANGE, { description: "主要色" });
    expect(styleTokenLine(token, "customProperties")).toBe(
      "/* brand-primary — 主要色 */\n--brand-primary: #ff5733;",
    );
  });

  it("description の改行は空白に潰す", () => {
    const token = solid("Brand Primary", ORANGE, { description: "主要色\nボタンに使う" });
    expect(styleTokenLine(token, "customProperties")).toContain("/* brand-primary — 主要色 ボタンに使う */");
  });

  it("空白だけの description ではコメントを出さない", () => {
    const token = solid("Brand Primary", ORANGE, { description: "   " });
    expect(styleTokenLine(token, "customProperties")).toBe("--brand-primary: #ff5733;");
  });
});

describe("buildStyleCss", () => {
  const tokens = [
    solid("Brand Primary"),
    { ...solid("Accent", SKY), id: "t2", apply: "color" as const },
  ];

  it("customProperties は変数宣言を1行ずつ並べる", () => {
    expect(buildStyleCss(tokens, "customProperties")).toBe(
      "--brand-primary: #ff5733;\n--accent: #33c1ff;",
    );
  });

  it("declarations は各トークンの apply で書く", () => {
    expect(buildStyleCss(tokens, "declarations")).toBe(
      "background: #ff5733;\ncolor: #33c1ff;",
    );
  });

  it("名前が空のトークンは落とす", () => {
    expect(buildStyleCss([solid(""), solid("Accent", SKY)], "customProperties")).toBe(
      "--accent: #33c1ff;",
    );
  });

  it("使える行が0なら空文字列", () => {
    expect(buildStyleCss([], "customProperties")).toBe("");
    expect(buildStyleCss([solid(""), solid("@@@")], "declarations")).toBe("");
  });
});
