export type Example = {
  /** 安定した React key。既定の1件だけは SSR と一致させるため固定値を使う。 */
  id: string;
  input: string;
  thinking: string;
  idealOutput: string;
  collapsed?: boolean;
};

export type PromptDraft = {
  instruction: string;
  examples: Example[];
  includeRealInput: boolean;
};

export const DEFAULT_EXAMPLE_ID = "default";

export function emptyExample(id: string): Example {
  return { id, input: "", thinking: "", idealOutput: "", collapsed: false };
}

/**
 * 既定の下書き。SSR とクライアント初回レンダで必ず同じ値になる必要があるため、
 * ここで randomUUID() を呼んではいけない。
 */
export function defaultDraft(): PromptDraft {
  return {
    instruction: "",
    examples: [emptyExample(DEFAULT_EXAMPLE_ID)],
    includeRealInput: true,
  };
}
