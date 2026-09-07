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
    kind: "styleTokens",
    label: "CSS style",
    hint: "色・グラデーションを選んで CSS で渡す",
    glyph: "❖",
    unique: true,
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
    styleTokens: [],
    styleTagName: "style_tokens",
    styleOutputMode: "customProperties",
  };
}

/** その種類のカードをもう追加できるか。 */
export function canAdd(sections: Section[], kind: SectionKind): boolean {
  if (!specFor(kind).unique) return true;
  return !sections.some((section) => section.kind === kind);
}

/**
 * recommend で足りないカードを補う。
 * **既にあるカードは動かさず**、無いものだけを推奨順の位置へ挿し込む。
 * custom は推奨順に無いので、挿入位置の判断材料にしない
 * （ユーザーが置いた場所のまま残る）。
 */
export function applyRecommended(sections: Section[]): Section[] {
  const next = [...sections];

  for (const kind of RECOMMENDED_ORDER) {
    if (!canAdd(next, kind)) continue;
    const rank = RECOMMENDED_ORDER.indexOf(kind);

    // 「自分より後ろに来るべき最初のカード」の手前に入れる。
    let insertAt = next.length;
    for (let i = 0; i < next.length; i += 1) {
      const other = RECOMMENDED_ORDER.indexOf(next[i].kind);
      if (other >= 0 && other > rank) {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, makeSection(kind, kind));
  }

  return next;
}

/** その種類のカードが今あるか。助言や変数の走査を出力と揃えるために使う。 */
export function hasSection(sections: Section[], kind: SectionKind): boolean {
  return sections.some((section) => section.kind === kind);
}

/** カードが残っているカスタムタグのノードだけを返す。 */
export function activeCustomIds(sections: Section[]): Set<string> {
  return new Set(
    sections.filter((section) => section.kind === "custom").map((section) => section.id),
  );
}
