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
   * リロードや並べ替えで表示が飛ばないよう、UI 内部 state ではなく下書きに持つ。
   */
  showThinking?: boolean;
};

/** カスタムセクションを examples の前に置くか後ろに置くか。トップレベルのみ意味を持つ。 */
export type Placement = "before" | "after";

/** 任意の XML タグ。children を持つことでいくらでもネストできる。 */
export type CustomNode = {
  id: string;
  tag: string;
  content: string;
  children: CustomNode[];
  collapsed?: boolean;
  /** トップレベルのセクションでのみ参照される。 */
  placement?: Placement;
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

export type PromptDraft = {
  role: string;
  instruction: string;
  constraints: string[];
  documents: DocumentEntry[];
  longContextMode: boolean;
  examples: Example[];
  customSections: CustomNode[];
  includeRealInput: boolean;
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

export function emptyNode(id: string, placement?: Placement): CustomNode {
  return { id, tag: "", content: "", children: [], collapsed: false, placement };
}

export function emptyDocument(id: string): DocumentEntry {
  return { id, source: "", content: "", collapsed: false };
}

/**
 * 既定の下書き。SSR とクライアント初回レンダで必ず同じ値になる必要があるため、
 * ここで randomUUID() を呼んではいけない。
 * example は使うとは限らないので0件で始める。
 */
export function defaultDraft(): PromptDraft {
  return {
    role: "",
    instruction: "",
    constraints: [],
    documents: [],
    longContextMode: false,
    examples: [],
    customSections: [],
    includeRealInput: true,
    outputSchema: "",
    effort: "",
    variableValues: {},
  };
}
