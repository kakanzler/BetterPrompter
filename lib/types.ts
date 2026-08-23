export type ExampleKind = "positive" | "negative";

export type Example = {
  id: string;
  input: string;
  thinking: string;
  idealOutput: string;
  collapsed?: boolean;
  /** 未指定は "positive"。旧データとの互換のため省略可能にしてある。 */
  kind?: ExampleKind;
  /**
   * thinking 欄（悪い例では「なぜダメか」）を出しているか。
   * 現行モデルでは不要な欄なので、既定では出さず必要なときだけ足す。
   */
  showThinking?: boolean;
};

/** 任意の XML タグ。children を持つことでいくらでもネストできる。 */
export type CustomNode = {
  id: string;
  tag: string;
  content: string;
  children: CustomNode[];
  collapsed?: boolean;
};

/** 長文資料。source は出典名で、空なら出力から省く。 */
export type DocumentEntry = {
  id: string;
  source: string;
  content: string;
  collapsed?: boolean;
};

/** output_config.effort。空文字列は「指定しない」。 */
export type Effort = "" | "low" | "medium" | "high" | "xhigh" | "max";

export type SectionKind =
  | "role"
  | "instruction"
  | "constraints"
  | "documents"
  | "examples"
  | "outputSchema"
  | "realInput"
  | "custom";

/**
 * 左ペインに並ぶカード1枚。並び順がそのまま出力順になる。
 * kind が "custom" のときだけ、id が対応する CustomNode の id と一致する。
 */
export type Section = { id: string; kind: SectionKind; collapsed?: boolean };

export type PromptDraft = {
  /** カードの並び順そのもの。 */
  sections: Section[];
  role: string;
  instruction: string;
  constraints: string[];
  documents: DocumentEntry[];
  examples: Example[];
  customSections: CustomNode[];
  /** output_config.format に渡す JSON Schema。文字列のまま持ち、表示時に検証する。 */
  outputSchema: string;
  effort: Effort;
  /** 変数のテスト値。プレビュー用で、下書き本体は書き換えない。 */
  variableValues: Record<string, string>;
};

export function emptyExample(id: string): Example {
  return {
    id,
    input: "",
    thinking: "",
    idealOutput: "",
    collapsed: false,
    kind: "positive",
    showThinking: false,
  };
}

export function emptyNode(id: string): CustomNode {
  return { id, tag: "", content: "", children: [], collapsed: false };
}

export function emptyDocument(id: string): DocumentEntry {
  return { id, source: "", content: "", collapsed: false };
}
