export type ExampleKind = "positive" | "negative";

export type Example = {
  /** 安定した React key。既定の1件だけは SSR と一致させるため固定値を使う。 */
  id: string;
  input: string;
  thinking: string;
  idealOutput: string;
  collapsed?: boolean;
  /** 未指定は "positive"。旧データとの互換のため省略可能にしてある。 */
  kind?: ExampleKind;
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

export type PromptDraft = {
  role: string;
  instruction: string;
  chainOfThought: boolean;
  constraints: string[];
  documents: DocumentEntry[];
  longContextMode: boolean;
  examples: Example[];
  customSections: CustomNode[];
  includeRealInput: boolean;
  prefill: string;
  /** 変数のテスト値。プレビュー用で、下書き本体は書き換えない。 */
  variableValues: Record<string, string>;
};

export const DEFAULT_EXAMPLE_ID = "default";

export function emptyExample(id: string): Example {
  return { id, input: "", thinking: "", idealOutput: "", collapsed: false, kind: "positive" };
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
 */
export function defaultDraft(): PromptDraft {
  return {
    role: "",
    instruction: "",
    chainOfThought: false,
    constraints: [],
    documents: [],
    longContextMode: false,
    examples: [emptyExample(DEFAULT_EXAMPLE_ID)],
    customSections: [],
    includeRealInput: true,
    prefill: "",
    variableValues: {},
  };
}
