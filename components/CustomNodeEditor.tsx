"use client";

import AutoTextarea from "./AutoTextarea";
import { useCollisionTags } from "./CollisionTags";
import { sanitizeTag } from "@/lib/buildPrompt";
import type { CustomNode } from "@/lib/types";

/** タグ名が空のときに出す定型タグ。押すと base_1, base_2 ... と連番で入る。 */
const TAG_PRESETS: { label: string; base: string }[] = [
  { label: "Task", base: "task" },
  { label: "reference", base: "reference" },
  { label: "answer", base: "answer" },
];

/** 既存のタグ名を見て、その base の使用済み最大番号 + 1 を返す。 */
function nextPresetTag(base: string, existing: string[]): string {
  const pattern = new RegExp(`^${base}_(\\d+)$`);
  const max = existing.reduce((acc, tag) => {
    const match = tag.match(pattern);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `${base}_${max + 1}`;
}

type Props = {
  node: CustomNode;
  depth: number;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<CustomNode>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onAddChild: (id: string) => void;
};

export default function CustomNodeEditor({
  node,
  depth,
  index,
  total,
  onChange,
  onDelete,
  onMove,
  onAddChild,
}: Props) {
  const collapsed = node.collapsed === true;
  const sanitized = sanitizeTag(node.tag);
  const existingTags = useCollisionTags();
  const label = sanitized ? `<${sanitized}>` : "タグ名未入力";
  // 入力そのままでは XML に使えず書き換えられた場合だけ、実際に出るタグを見せる。
  const showsRewrite = sanitized !== "" && sanitized !== node.tag.trim();

  return (
    <div className={depth === 0 ? "custom-node custom-node-root" : "custom-node"}>
      <header className="custom-node-head">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!collapsed}
          aria-label={`${label} を${collapsed ? "開く" : "折りたたむ"}`}
          onClick={() => onChange(node.id, { collapsed: !collapsed })}
        >
          <span className="chevron" aria-hidden="true">
            {collapsed ? "▶" : "▼"}
          </span>
        </button>

        <span className="tag-editor">
          <span className="bracket" aria-hidden="true">
            &lt;
          </span>
          <input
            className="tag-input"
            style={{ width: `calc(${Math.min(Math.max(node.tag.length + 1, 9), 28)}ch + 20px)` }}
            value={node.tag}
            placeholder="tag_name"
            spellCheck={false}
            aria-label="タグ名"
            onChange={(event) => onChange(node.id, { tag: event.target.value })}
          />
          <span className="bracket" aria-hidden="true">
            &gt;
          </span>
        </span>

        {showsRewrite && <span className="tag-hint">→ &lt;{sanitized}&gt;</span>}


        <div className="custom-node-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} を上へ移動`}
            disabled={index === 0}
            onClick={() => onMove(node.id, -1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} を下へ移動`}
            disabled={index === total - 1}
            onClick={() => onMove(node.id, 1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`${label} を削除`}
            onClick={() => onDelete(node.id)}
          >
            ✕
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="custom-node-body">
          {depth === 0 && !sanitized && (
            <div className="tag-presets">
              <span className="tag-presets-label">プリセット</span>
              {TAG_PRESETS.map((preset) => (
                <button
                  key={preset.base}
                  type="button"
                  className="tag-preset"
                  onClick={() =>
                    onChange(node.id, { tag: nextPresetTag(preset.base, existingTags) })
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <AutoTextarea
            value={node.content}
            placeholder="このタグの中身（入れ子だけにするなら空でよい）"
            onChange={(content) => onChange(node.id, { content })}
          />

          {node.children.length > 0 && (
            <div className="custom-children">
              {node.children.map((child, childIndex) => (
                <CustomNodeEditor
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  index={childIndex}
                  total={node.children.length}
                  onChange={onChange}
                  onDelete={onDelete}
                  onMove={onMove}
                  onAddChild={onAddChild}
                />
              ))}
            </div>
          )}

          <button type="button" className="add-child" onClick={() => onAddChild(node.id)}>
            ＋ 入れ子タグを追加
          </button>
        </div>
      )}
    </div>
  );
}
