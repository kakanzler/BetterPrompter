export type Example = {
  /** 安定した React key。既定の1件だけは SSR と一致させるため固定値を使う。 */
  id: string;
  input: string;
  thinking: string;
  idealOutput: string;
  collapsed?: boolean;
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

export type PromptDraft = {
  instruction: string;
  examples: Example[];
  customSections: CustomNode[];
  includeRealInput: boolean;
};

export const DEFAULT_EXAMPLE_ID = "default";

export function emptyExample(id: string): Example {
  return { id, input: "", thinking: "", idealOutput: "", collapsed: false };
}

export function emptyNode(id: string, placement?: Placement): CustomNode {
  return { id, tag: "", content: "", children: [], collapsed: false, placement };
}

/**
 * 既定の下書き。SSR とクライアント初回レンダで必ず同じ値になる必要があるため、
 * ここで randomUUID() を呼んではいけない。
 */
export function defaultDraft(): PromptDraft {
  return {
    instruction: "",
    examples: [emptyExample(DEFAULT_EXAMPLE_ID)],
    customSections: [],
    includeRealInput: true,
  };
}
