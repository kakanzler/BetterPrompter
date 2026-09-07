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
  | "custom"
  | "styleTokens";

/** r,g,b は整数 0–255、a は 0–1。 */
export type Rgba = { r: number; g: number; b: number; a: number };

/** グラデーションの色停止点。position は 0–100（%）。 */
export type GradientStop = { id: string; color: Rgba; position: number };

export type StyleTokenType = "solid" | "linear" | "radial";

/** プレビューの当て先であり、宣言モードで出力する CSS プロパティ名でもある。 */
export type StyleApply = "color" | "background" | "border-color";

export type SolidValue = { color: Rgba };
/** angle は 0–360（deg）。 */
export type LinearValue = { angle: number; stops: GradientStop[] };
export type RadialValue = { shape: "circle" | "ellipse"; stops: GradientStop[] };
/** 兄弟の StyleToken.type で判別する。 */
export type StyleTokenValue = SolidValue | LinearValue | RadialValue;

export type StyleToken = {
  id: string;
  /** CSS 識別子へ sanitize される（例 "brand-primary"）。 */
  name: string;
  type: StyleTokenType;
  /** 形は必ず type と一致する。 */
  value: StyleTokenValue;
  /** プレビューの当て先 & 宣言モードの出力プロパティ（永続）。 */
  apply: StyleApply;
  /** 任意の一行説明。出力に CSS コメントで添える。 */
  description?: string;
  collapsed?: boolean;
};

/** 生成プロンプトへ出す CSS の書き方。 */
export type StyleOutputMode = "customProperties" | "declarations";

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
  /** CSS スタイルトークン。並び順がそのまま出力ブロック内の行順になる。 */
  styleTokens: StyleToken[];
  /** スタイルトークンを包む XML タグ名。既定 "style_tokens"。 */
  styleTagName: string;
  /** スタイルトークンの出力形式。既定 "customProperties"。 */
  styleOutputMode: StyleOutputMode;
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

/** グラデーションの色停止点。色を省いたときは不透明の黒。 */
export function emptyGradientStop(id: string, position: number, color?: Rgba): GradientStop {
  return { id, position, color: color ?? { r: 0, g: 0, b: 0, a: 1 } };
}

export function emptyStyleToken(id: string): StyleToken {
  return {
    id,
    name: "",
    type: "solid",
    value: { color: { r: 255, g: 87, b: 51, a: 1 } },
    apply: "background",
    collapsed: false,
  };
}
