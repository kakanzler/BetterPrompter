import { activeCustomIds, hasSection } from "./sections";
import type { CustomNode, PromptDraft } from "./types";

/** `{{NAME}}` 形式のプレースホルダ。名前は英数字とアンダースコアのみ。 */
const VARIABLE = /\{\{([A-Za-z0-9_]+)\}\}/g;

function collect(text: string, into: Set<string>): void {
  // 正規表現に g フラグがあるため lastIndex を持ち回さないよう毎回作り直す。
  for (const match of text.matchAll(VARIABLE)) {
    into.add(match[1]);
  }
}

function collectNodes(nodes: CustomNode[], into: Set<string>): void {
  for (const node of nodes) {
    collect(node.tag, into);
    collect(node.content, into);
    collectNodes(node.children, into);
  }
}

/**
 * 下書き全体から変数名を重複なく集める。
 * 出現順を保つので、パネルの並びが入力した順と一致する。
 */
export function extractVariables(draft: PromptDraft): string[] {
  const found = new Set<string>();
  const has = (kind: Parameters<typeof hasSection>[1]) => hasSection(draft.sections, kind);

  // カードを消した項目のデータは出力に出ないので、変数としても拾わない。
  if (has("role")) collect(draft.role, found);
  if (has("instruction")) collect(draft.instruction, found);
  if (has("outputSchema")) collect(draft.outputSchema, found);
  if (has("constraints")) {
    for (const constraint of draft.constraints) collect(constraint, found);
  }
  if (has("documents")) {
    for (const document of draft.documents) {
      collect(document.source, found);
      collect(document.content, found);
    }
  }
  if (has("examples")) {
    for (const example of draft.examples) {
      collect(example.input, found);
      collect(example.thinking, found);
      collect(example.idealOutput, found);
    }
  }

  const active = activeCustomIds(draft.sections);
  collectNodes(
    draft.customSections.filter((node) => active.has(node.id)),
    found,
  );

  // 実入力の枠カードがあれば {{INPUT}} が必ず出るので、候補に含める。
  if (has("realInput")) found.add("INPUT");

  return [...found];
}

/**
 * テスト値を当てはめる。値が未設定・空文字列の変数は
 * `{{NAME}}` のまま残し、埋まっていないことが見て分かるようにする。
 */
export function applyVariables(text: string, values: Record<string, string>): string {
  return text.replace(VARIABLE, (whole, name: string) => {
    const value = values[name];
    return value ? value : whole;
  });
}
