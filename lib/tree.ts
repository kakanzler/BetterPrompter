import type { CustomNode } from "./types";

/** id 一致のノードだけを差し替える。見つからなければ子を再帰的にたどる。 */
export function patchNode(
  nodes: CustomNode[],
  id: string,
  patch: Partial<CustomNode>,
): CustomNode[] {
  return nodes.map((node) =>
    node.id === id
      ? { ...node, ...patch }
      : { ...node, children: patchNode(node.children, id, patch) },
  );
}

/** id 一致のノードを（子孫ごと）取り除く。 */
export function removeNode(nodes: CustomNode[], id: string): CustomNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

/** 兄弟の中でだけ前後に動かす。階層をまたぐ移動はしない。 */
export function moveNode(nodes: CustomNode[], id: string, direction: -1 | 1): CustomNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return nodes.map((node) => ({ ...node, children: moveNode(node.children, id, direction) }));
}

/** id 一致のノードの末尾に子を足す。折りたたみ中なら開く。 */
export function appendChild(nodes: CustomNode[], id: string, child: CustomNode): CustomNode[] {
  return nodes.map((node) =>
    node.id === id
      ? { ...node, collapsed: false, children: [...node.children, child] }
      : { ...node, children: appendChild(node.children, id, child) },
  );
}
