import { describe, expect, it } from "vitest";
import { applyRecommended, canAdd, defaultDraft, makeSection, RECOMMENDED_ORDER } from "./sections";
import type { Section, SectionKind } from "./types";

const kinds = (sections: Section[]) => sections.map((section) => section.kind);

function sections(...list: SectionKind[]): Section[] {
  return list.map((kind, index) => makeSection(kind, kind === "custom" ? `c${index}` : kind));
}

describe("defaultDraft", () => {
  it("初期は Role / Instruction / 実入力の3枚", () => {
    expect(kinds(defaultDraft().sections)).toEqual(["role", "instruction", "realInput"]);
  });

  it("id は kind から決め打ちで、SSR と一致する", () => {
    expect(defaultDraft().sections).toEqual(defaultDraft().sections);
  });
});

describe("canAdd", () => {
  it("単数カードは1枚あるともう足せない", () => {
    expect(canAdd(sections("instruction"), "instruction")).toBe(false);
    expect(canAdd(sections("instruction"), "examples")).toBe(true);
  });

  it("custom は何枚でも足せる", () => {
    expect(canAdd(sections("custom", "custom"), "custom")).toBe(true);
  });
});

describe("applyRecommended", () => {
  it("空から推奨構成を揃える", () => {
    expect(kinds(applyRecommended([]))).toEqual(RECOMMENDED_ORDER);
  });

  it("既定の3枚に足りない分だけを正しい位置へ挿し込む", () => {
    expect(kinds(applyRecommended(defaultDraft().sections))).toEqual(RECOMMENDED_ORDER);
  });

  it("すべて揃っていれば何も変えない", () => {
    const full = applyRecommended([]);
    expect(applyRecommended(full)).toEqual(full);
  });

  it("ユーザーが置いた custom カードを動かさない", () => {
    const before = sections("custom", "role", "instruction", "realInput");
    const after = applyRecommended(before);
    // custom は先頭のまま。
    expect(after[0].kind).toBe("custom");
    expect(after[0].id).toBe(before[0].id);
  });

  it("実入力の枠より後ろへカードを差し込まない", () => {
    const after = kinds(applyRecommended(sections("custom", "role", "instruction", "realInput")));
    const realInput = after.indexOf("realInput");
    // realInput の後ろに残るのは何も無い（custom は先頭にいる）。
    expect(after.slice(realInput + 1)).toEqual([]);
  });

  it("並べ替え済みの既存カードの相対順を保つ", () => {
    const before = sections("examples", "instruction");
    const after = kinds(applyRecommended(before));
    expect(after.indexOf("examples")).toBeLessThan(after.indexOf("instruction"));
  });

  it("複数の custom があってもすべて残る", () => {
    const before = sections("custom", "instruction", "custom");
    const after = applyRecommended(before);
    expect(after.filter((section) => section.kind === "custom")).toHaveLength(2);
  });
});
