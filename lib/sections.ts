import type { PromptDraft, Section, SectionKind } from "./types";

export type SectionSpec = {
  kind: SectionKind;
  label: string;
  hint: string;
  /** メニューに出すアイコン代わりの記号。 */
  glyph: string;
  /** 1枚しか置けない種類か。custom だけ false。 */
  unique: boolean;
  /**
   * user ターンに出るか。role は system、outputSchema は output_config へ入るため
   * 並び順が出力に影響しない。カード上に注記を出す判断にも使う。
   */
  ordered: boolean;
  /** ordered が false のカードに出す注記。 */
  note?: string;
};

export const SECTION_SPECS: SectionSpec[] = [
  {
    kind: "role",
    label: "Role / System",
    hint: "モデルに与える役割",
    glyph: "◆",
    unique: true,
    ordered: false,
    note: "system ターンに入ります（並び順の影響なし）",
  },
  {
    kind: "instruction",
    label: "Instruction",
    hint: "やってほしいこと",
    glyph: "▸",
    unique: true,
    ordered: true,
  },
  {
    kind: "constraints",
    label: "constraints",
    hint: "守ってほしい条件を箇条書きで",
    glyph: "≡",
    unique: true,
    ordered: true,
  },
  {
    kind: "documents",
    label: "documents",
    hint: "モデルに読ませる長文資料",
    glyph: "▤",
    unique: true,
    ordered: true,
  },
  {
    kind: "examples",
    label: "example",
    hint: "few-shot の良い例・悪い例",
    glyph: "❏",
    unique: true,
    ordered: true,
  },
  {
    kind: "custom",
    label: "custom tag",
    hint: "任意の XML タグ（いくらでも追加できます）",
    glyph: "◇",
    unique: false,
    ordered: true,
  },
  {
    kind: "realInput",
    label: "実入力の枠",
    hint: "{{INPUT}} の差し込み位置",
    glyph: "⌷",
    unique: true,
    ordered: true,
  },
  {
    kind: "outputSchema",
    label: "Output schema",
    hint: "structured outputs で出力の形を固定する",
    glyph: "⌘",
    unique: true,
    ordered: false,
    note: "API パラメータです（並び順の影響なし）",
  },
];

export function specFor(kind: SectionKind): SectionSpec {
  const spec = SECTION_SPECS.find((entry) => entry.kind === kind);
  if (!spec) throw new Error(`unknown section kind: ${kind}`);
  return spec;
}

/**
 * 「recommend」で一気に揃える並び。
 * Prompt Engineering の定石どおり、資料 → 指示 → 制約 → 例 → 実入力の順に置く。
 */
export const RECOMMENDED_ORDER: SectionKind[] = [
  "role",
  "documents",
  "instruction",
  "constraints",
  "examples",
  "outputSchema",
  "realInput",
];

/** 初期表示。まず書き始められる最小限に、既定の実入力枠を足したもの。 */
export const DEFAULT_KINDS: SectionKind[] = ["role", "instruction", "realInput"];

export function makeSection(kind: SectionKind, id: string): Section {
  return { id, kind, collapsed: false };
}

/**
 * 既定の下書き。SSR とクライアント初回レンダで必ず同じ値になる必要があるため、
 * ここで randomUUID() を呼んではいけない（id は kind から決め打ちする）。
 */
export function defaultDraft(): PromptDraft {
  return {
    sections: DEFAULT_KINDS.map((kind) => makeSection(kind, kind)),
    role: "",
    instruction: "",
    constraints: [],
    documents: [],
    examples: [],
    customSections: [],
    outputSchema: "",
    effort: "",
    variableValues: {},
  };
}

/** その種類のカードをもう追加できるか。 */
export function canAdd(sections: Section[], kind: SectionKind): boolean {
  if (!specFor(kind).unique) return true;
  return !sections.some((section) => section.kind === kind);
}

/**
 * recommend で足りないカードを補う。既にあるものはそのまま、
 * 無いものだけを RECOMMENDED_ORDER の位置関係を保って挿入する。
 */
export function applyRecommended(sections: Section[], newId: () => string): Section[] {
  const missing = RECOMMENDED_ORDER.filter((kind) => canAdd(sections, kind));
  if (missing.length === 0) return sections;

  // 推奨順の通し番号で並べ替えられるよう、既存カードにも番号を振る。
  const rank = (kind: SectionKind) => {
    const index = RECOMMENDED_ORDER.indexOf(kind);
    // 推奨順に無いもの（custom）は末尾側へ寄せるが、相対順は保つ。
    return index < 0 ? RECOMMENDED_ORDER.length : index;
  };

  const merged = [...sections, ...missing.map((kind) => makeSection(kind, newId()))];
  return merged
    .map((section, index) => ({ section, index }))
    .sort((a, b) => rank(a.section.kind) - rank(b.section.kind) || a.index - b.index)
    .map((entry) => entry.section);
}
