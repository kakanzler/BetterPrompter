"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import AutoTextarea from "@/components/AutoTextarea";
import ConstraintList from "@/components/ConstraintList";
import { CollisionTagsProvider } from "@/components/CollisionTags";
import ContextMenu, { type MenuPosition } from "@/components/ContextMenu";
import CustomNodeEditor from "@/components/CustomNodeEditor";
import DocumentCard from "@/components/DocumentCard";
import ExampleCard from "@/components/ExampleCard";
import LintPanel from "@/components/LintPanel";
import MigrationNotice from "@/components/MigrationNotice";
import OutputPanel from "@/components/OutputPanel";
import OutputSchemaEditor from "@/components/OutputSchemaEditor";
import SectionCard from "@/components/SectionCard";
import Toast, { type ToastState } from "@/components/Toast";
import VariablePanel from "@/components/VariablePanel";
import { buildPrompt, customTagNames, sanitizeTag, type BuiltPrompt } from "@/lib/buildPrompt";
import { lintDraft } from "@/lib/lint";
import { buildOutputConfig } from "@/lib/outputConfig";
import { applyRecommended, canAdd, makeSection, RECOMMENDED_ORDER, specFor } from "@/lib/sections";
import { appendChild, moveNode, patchNode, removeNode } from "@/lib/tree";
import {
  emptyDocument,
  emptyExample,
  emptyNode,
  type CustomNode,
  type DocumentEntry,
  type Effort,
  type Example,
  type Section,
  type SectionKind,
} from "@/lib/types";
import { normalizeDraft, useDraftStorage } from "@/lib/useDraftStorage";
import { applyVariables, extractVariables } from "@/lib/variables";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 配列の要素を隣と入れ替える。範囲外なら元の配列をそのまま返す。 */
function swap<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** from の要素を抜き取り、to の位置へ差し込む。 */
function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function Page() {
  const [draft, setDraft, droppedPrefill] = useDraftStorage();
  // プレビューは表示モードなので下書きには保存しない。
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variables = useMemo(() => extractVariables(draft), [draft]);
  const findings = useMemo(() => lintDraft(draft), [draft]);
  const outputConfig = useMemo(() => buildOutputConfig(draft), [draft]);
  const collisionTags = useMemo(() => customTagNames(draft.customSections), [draft.customSections]);

  const raw = useMemo(() => buildPrompt(draft), [draft]);
  const hasOutput = Boolean(raw.system || raw.user || outputConfig);

  const built = useMemo<BuiltPrompt>(() => {
    if (!previewEnabled) return raw;
    const values = draft.variableValues;
    return {
      system: applyVariables(raw.system, values),
      user: applyVariables(raw.user, values),
      blocks: raw.blocks.map((block) => ({
        ...block,
        text: applyVariables(block.text, values),
      })),
    };
  }, [raw, previewEnabled, draft.variableValues]);

  // ---- セクション（カード）操作 ----

  function patchSection(id: string, patch: Partial<Section>) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    }));
  }

  function moveSection(id: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      sections: swap(
        current.sections,
        current.sections.findIndex((section) => section.id === id),
        direction,
      ),
    }));
  }

  /**
   * ドラッグ中のカードが対象カードの上下どちらへ着地するか。
   * reorder は「抜いてから差し込む」ので、下へ運ぶと対象の後ろに入る。
   * 目印もそれに合わせないと見た目と結果が食い違う。
   */
  function dropPositionFor(targetId: string): "before" | "after" | null {
    if (!dragId || overId !== targetId || dragId === targetId) return null;
    const from = draft.sections.findIndex((section) => section.id === dragId);
    const to = draft.sections.findIndex((section) => section.id === targetId);
    return from < to ? "after" : "before";
  }

  function dropSection(targetId: string) {
    const sourceId = dragId;
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    setDraft((current) => ({
      ...current,
      sections: reorder(
        current.sections,
        current.sections.findIndex((section) => section.id === sourceId),
        current.sections.findIndex((section) => section.id === targetId),
      ),
    }));
  }

  function deleteSection(section: Section) {
    // 消す前の状態を控えておき、どの種類のカードでも同じように取り消せるようにする。
    const snapshot = draft;
    const label = section.kind === "custom" ? (titleFor(section) ?? "custom tag") : specFor(section.kind).label;

    setDraft((current) => ({
      ...current,
      sections: current.sections.filter((entry) => entry.id !== section.id),
      // custom はカードとノードが1対1なので、残すと辿れないゴミになる。一緒に消す。
      customSections:
        section.kind === "custom"
          ? removeNode(current.customSections, section.id)
          : current.customSections,
    }));

    setToast({ message: `${label} を削除しました`, onUndo: () => setDraft(snapshot) });
  }

  function addSection(kind: SectionKind) {
    setDraft((current) => {
      if (!canAdd(current.sections, kind)) return current;
      if (kind === "custom") {
        const id = newId();
        return {
          ...current,
          sections: [...current.sections, makeSection("custom", id)],
          customSections: [...current.customSections, emptyNode(id)],
        };
      }
      return { ...current, sections: [...current.sections, makeSection(kind, kind)] };
    });
  }

  function addRecommended() {
    setDraft((current) => ({ ...current, sections: applyRecommended(current.sections) }));
  }

  // ---- カードの中身 ----

  function updateExample(id: string, patch: Partial<Example>) {
    setDraft((current) => ({
      ...current,
      examples: current.examples.map((example) =>
        example.id === id ? { ...example, ...patch } : example,
      ),
    }));
  }

  function updateDocument(id: string, patch: Partial<DocumentEntry>) {
    setDraft((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === id ? { ...document, ...patch } : document,
      ),
    }));
  }

  function updateNode(id: string, patch: Partial<CustomNode>) {
    setDraft((current) => ({
      ...current,
      customSections: patchNode(current.customSections, id, patch),
    }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "betterprompter.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      const restored = normalizeDraft(JSON.parse(await file.text()));
      if (restored) setDraft(restored.draft);
      else setToast({ message: "この JSON は BetterPrompter の形式ではありません。" });
    } catch {
      setToast({ message: "JSON を読み込めませんでした。" });
    }
  }

  function renderBody(section: Section): ReactNode {
    switch (section.kind) {
      case "role":
        return (
          <AutoTextarea
            value={draft.role}
            rows={2}
            placeholder="モデルに与える役割（例: あなたは経験豊富な編集者です）"
            onChange={(role) => setDraft((current) => ({ ...current, role }))}
          />
        );
      case "instruction":
        return (
          <AutoTextarea
            value={draft.instruction}
            rows={3}
            placeholder="モデルにやってほしいことを書く（例: 記事を3行で要約してください）"
            onChange={(instruction) => setDraft((current) => ({ ...current, instruction }))}
          />
        );
      case "constraints":
        return (
          <ConstraintList
            constraints={draft.constraints}
            onChange={(constraints) => setDraft((current) => ({ ...current, constraints }))}
          />
        );
      case "documents":
        return (
          <>
            {draft.documents.map((document, index) => (
              <DocumentCard
                key={document.id}
                document={document}
                index={index}
                total={draft.documents.length}
                onChange={(patch) => updateDocument(document.id, patch)}
                onDelete={() =>
                  setDraft((current) => ({
                    ...current,
                    documents: current.documents.filter((entry) => entry.id !== document.id),
                  }))
                }
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    documents: swap(current.documents, index, direction),
                  }))
                }
              />
            ))}
            <button
              type="button"
              className="add-example"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  documents: [...current.documents, emptyDocument(newId())],
                }))
              }
            >
              ＋ add document
            </button>
          </>
        );
      case "examples":
        return (
          <>
            {draft.examples.map((example, index) => (
              <ExampleCard
                key={example.id}
                example={example}
                index={index}
                total={draft.examples.length}
                onChange={(patch) => updateExample(example.id, patch)}
                onDelete={() =>
                  setDraft((current) => ({
                    ...current,
                    examples: current.examples.filter((entry) => entry.id !== example.id),
                  }))
                }
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    examples: swap(current.examples, index, direction),
                  }))
                }
              />
            ))}
            <button
              type="button"
              className="add-example"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  examples: [...current.examples, emptyExample(newId())],
                }))
              }
            >
              ＋ add example
            </button>
          </>
        );
      case "custom": {
        const node = draft.customSections.find((entry) => entry.id === section.id);
        if (!node) return null;
        return (
          <CustomNodeEditor
            node={node}
            depth={0}
            index={0}
            total={1}
            onChange={updateNode}
            onDelete={(id) =>
              setDraft((current) => ({
                ...current,
                customSections: removeNode(current.customSections, id),
              }))
            }
            onMove={(id, direction) =>
              setDraft((current) => ({
                ...current,
                customSections: moveNode(current.customSections, id, direction),
              }))
            }
            onAddChild={(id) =>
              setDraft((current) => ({
                ...current,
                customSections: appendChild(current.customSections, id, emptyNode(newId())),
              }))
            }
          />
        );
      }
      case "outputSchema":
        return (
          <OutputSchemaEditor
            schema={draft.outputSchema}
            effort={draft.effort}
            onChangeSchema={(outputSchema) => setDraft((current) => ({ ...current, outputSchema }))}
            onChangeEffort={(effort: Effort) => setDraft((current) => ({ ...current, effort }))}
          />
        );
      case "realInput":
        return (
          <p className="real-input-note">
            ここに <code>{"{{INPUT}}"}</code> の枠が入ります。使うときに実際の入力へ差し替えてください。
          </p>
        );
    }
  }

  function titleFor(section: Section): string | undefined {
    if (section.kind !== "custom") return undefined;
    const node = draft.customSections.find((entry) => entry.id === section.id);
    const tag = sanitizeTag(node?.tag ?? "");
    return tag ? `<${tag}>` : "custom tag";
  }

  // custom は何枚でも置けるので、無効化するのは既にある単数カードだけ。
  const disabledKinds = useMemo(
    () =>
      new Set(
        draft.sections
          .map((section) => section.kind)
          .filter((kind) => kind !== "custom"),
      ),
    [draft.sections],
  );

  const recommendAvailable = useMemo(
    () => RECOMMENDED_ORDER.some((kind) => canAdd(draft.sections, kind)),
    [draft.sections],
  );

  return (
    <CollisionTagsProvider value={collisionTags}>
    <main className="page">
      <header className="page-head">
        <h1 className="app-title">BetterPrompter</h1>
        <div className="page-head-actions">
          <button type="button" className="text-button" onClick={exportJson}>
            Export JSON
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importJson(file);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {droppedPrefill && <MigrationNotice droppedPrefill={droppedPrefill} />}

      <div className="layout">
        <div
          className="pane pane-input"
          onContextMenu={(event) => {
            // 入力欄の上ではブラウザ標準のメニュー（貼り付け・スペルチェック）を残す。
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, [contenteditable='true']")) return;
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY });
          }}
        >
          <p className="pane-hint">右クリックでカードを追加 / ⠿ をドラッグで並べ替え</p>

          {draft.sections.map((section, index) => (
            <SectionCard
              key={section.id}
              spec={specFor(section.kind)}
              title={titleFor(section)}
              collapsed={section.collapsed === true}
              index={index}
              total={draft.sections.length}
              dragging={dragId === section.id}
              dropPosition={dropPositionFor(section.id)}
              onToggleCollapse={() => patchSection(section.id, { collapsed: !section.collapsed })}
              onDelete={() => deleteSection(section)}
              onMove={(direction) => moveSection(section.id, direction)}
              onDragStart={() => setDragId(section.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={() => setOverId(section.id)}
              onDrop={() => dropSection(section.id)}
            >
              {renderBody(section)}
            </SectionCard>
          ))}

          {draft.sections.length === 0 && (
            <p className="pane-empty">
              カードがありません。右クリックして <strong>recommend</strong> を選ぶと、
              よく使う構成が一度に揃います。
            </p>
          )}

          {hasOutput && variables.length > 0 && (
            <section className="section-card section-card-static" aria-label="variables">
              <header className="section-card-head">
                <span className="section-card-title">variables</span>
                <span className="section-card-note">
                  本文から自動で拾います（並べ替え・削除はありません）
                </span>
              </header>
              <VariablePanel
              variables={variables}
              values={draft.variableValues}
              previewEnabled={previewEnabled}
              onTogglePreview={setPreviewEnabled}
              onChangeValue={(name, value) =>
                setDraft((current) => ({
                  ...current,
                  variableValues: { ...current.variableValues, [name]: value },
                }))
                }
              />
            </section>
          )}
        </div>

        <aside className="pane pane-output">
          <OutputPanel built={built} outputConfig={outputConfig} />
          {hasOutput && <LintPanel findings={findings} />}
        </aside>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {menu && (
        <ContextMenu
          position={menu}
          disabledKinds={disabledKinds}
          recommendAvailable={recommendAvailable}
          onAdd={addSection}
          onRecommend={addRecommended}
          onClose={() => setMenu(null)}
        />
      )}
    </main>
    </CollisionTagsProvider>
  );
}
