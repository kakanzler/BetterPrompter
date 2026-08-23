"use client";

import { useMemo, useRef, useState } from "react";
import AutoTextarea from "@/components/AutoTextarea";
import ConstraintList from "@/components/ConstraintList";
import CustomNodeEditor from "@/components/CustomNodeEditor";
import DocumentCard from "@/components/DocumentCard";
import ExampleCard from "@/components/ExampleCard";
import LintPanel from "@/components/LintPanel";
import MigrationNotice from "@/components/MigrationNotice";
import OutputPanel from "@/components/OutputPanel";
import OutputSchemaEditor from "@/components/OutputSchemaEditor";
import VariablePanel from "@/components/VariablePanel";
import { buildPrompt, type BuiltPrompt } from "@/lib/buildPrompt";
import { lintDraft } from "@/lib/lint";
import { buildOutputConfig } from "@/lib/outputConfig";
import { appendChild, moveNode, patchNode, removeNode } from "@/lib/tree";
import {
  emptyDocument,
  emptyExample,
  emptyNode,
  type CustomNode,
  type DocumentEntry,
  type Effort,
  type Example,
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

export default function Page() {
  const [draft, setDraft, droppedPrefill] = useDraftStorage();
  // プレビューは表示モードなので下書きには保存しない。
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variables = useMemo(() => extractVariables(draft), [draft]);
  const findings = useMemo(() => lintDraft(draft), [draft]);
  const outputConfig = useMemo(() => buildOutputConfig(draft), [draft]);

  const built = useMemo<BuiltPrompt>(() => {
    const raw = buildPrompt(draft);
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
  }, [draft, previewEnabled]);

  function updateExample(id: string, patch: Partial<Example>) {
    setDraft((current) => ({
      ...current,
      examples: current.examples.map((example) =>
        example.id === id ? { ...example, ...patch } : example,
      ),
    }));
  }

  function addExample() {
    setDraft((current) => ({
      ...current,
      examples: [...current.examples, emptyExample(newId())],
    }));
  }

  function deleteExample(id: string) {
    setDraft((current) => {
      const remaining = current.examples.filter((example) => example.id !== id);
      // 全部消すと入力できる場所がなくなるので、空のカードを1枚残す。
      return {
        ...current,
        examples: remaining.length > 0 ? remaining : [emptyExample(newId())],
      };
    });
  }

  function moveExample(id: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      examples: swap(
        current.examples,
        current.examples.findIndex((example) => example.id === id),
        direction,
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

  function addDocument() {
    setDraft((current) => ({
      ...current,
      documents: [...current.documents, emptyDocument(newId())],
    }));
  }

  function deleteDocument(id: string) {
    setDraft((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== id),
    }));
  }

  function moveDocument(id: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      documents: swap(
        current.documents,
        current.documents.findIndex((document) => document.id === id),
        direction,
      ),
    }));
  }

  function updateNode(id: string, patch: Partial<CustomNode>) {
    setDraft((current) => ({
      ...current,
      customSections: patchNode(current.customSections, id, patch),
    }));
  }

  function deleteNode(id: string) {
    setDraft((current) => ({
      ...current,
      customSections: removeNode(current.customSections, id),
    }));
  }

  function moveNodeBy(id: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      customSections: moveNode(current.customSections, id, direction),
    }));
  }

  function addChildNode(id: string) {
    setDraft((current) => ({
      ...current,
      customSections: appendChild(current.customSections, id, emptyNode(newId())),
    }));
  }

  function addSection() {
    setDraft((current) => ({
      ...current,
      customSections: [...current.customSections, emptyNode(newId(), "before")],
    }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
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
      else window.alert("この JSON は BetterPrompter の形式ではありません。");
    } catch {
      window.alert("JSON を読み込めませんでした。");
    }
  }

  return (
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
              // 同じファイルを続けて選べるように値をリセットする。
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {droppedPrefill && <MigrationNotice droppedPrefill={droppedPrefill} />}

      <AutoTextarea
        label="Role / System"
        value={draft.role}
        rows={2}
        placeholder="モデルに与える役割（例: あなたは経験豊富な編集者です）"
        onChange={(role) => setDraft((current) => ({ ...current, role }))}
      />

      <AutoTextarea
        label="Instruction"
        value={draft.instruction}
        rows={3}
        placeholder="モデルにやってほしいことを書く（例: 記事を3行で要約してください）"
        onChange={(instruction) => setDraft((current) => ({ ...current, instruction }))}
      />

      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.chainOfThought}
          onChange={(event) =>
            setDraft((current) => ({ ...current, chainOfThought: event.target.checked }))
          }
        />
        Chain-of-Thought — <code>&lt;thinking&gt;</code> で考えてから{" "}
        <code>&lt;answer&gt;</code> で答えるよう指示する
      </label>
      <p className="inline-note">
        現行の Claude は内部で思考するため、この指示は不要です（旧モデルや他社モデルに貼るとき用）。
        深さは下の <code>effort</code> で指定してください。
      </p>

      <div className="section-head">
        <h2 className="section-label">constraints</h2>
        <span className="section-note">守ってほしい条件を箇条書きで</span>
      </div>
      <ConstraintList
        constraints={draft.constraints}
        onChange={(constraints) => setDraft((current) => ({ ...current, constraints }))}
      />

      <div className="section-head">
        <h2 className="section-label">documents</h2>
        <span className="section-note">長文資料。プロンプトの先頭に置かれます</span>
      </div>

      {draft.documents.length > 0 && (
        <div className="document-list">
          {draft.documents.map((document, index) => (
            <DocumentCard
              key={document.id}
              document={document}
              index={index}
              total={draft.documents.length}
              onChange={(patch) => updateDocument(document.id, patch)}
              onDelete={() => deleteDocument(document.id)}
              onMove={(direction) => moveDocument(document.id, direction)}
            />
          ))}
        </div>
      )}

      <button type="button" className="add-example" onClick={addDocument}>
        ＋ add document
      </button>

      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.longContextMode}
          onChange={(event) =>
            setDraft((current) => ({ ...current, longContextMode: event.target.checked }))
          }
        />
        long-context モード — 資料が長いとき、指示を example の後ろ（末尾寄り）へ移す
      </label>

      <div className="section-head">
        <h2 className="section-label">example</h2>
        <span className="section-note">良い例と悪い例を切り替えられます</span>
      </div>

      <div className="example-list">
        {draft.examples.map((example, index) => (
          <ExampleCard
            key={example.id}
            example={example}
            index={index}
            total={draft.examples.length}
            onChange={(patch) => updateExample(example.id, patch)}
            onDelete={() => deleteExample(example.id)}
            onMove={(direction) => moveExample(example.id, direction)}
          />
        ))}
      </div>

      <button type="button" className="add-example" onClick={addExample}>
        ＋ add example
      </button>

      <div className="section-head">
        <h2 className="section-label">custom tags</h2>
        <span className="section-note">任意の XML タグをいくらでもネストできます</span>
      </div>

      {draft.customSections.length > 0 && (
        <div className="custom-list">
          {draft.customSections.map((section, index) => (
            <CustomNodeEditor
              key={section.id}
              node={section}
              depth={0}
              index={index}
              total={draft.customSections.length}
              onChange={updateNode}
              onDelete={deleteNode}
              onMove={moveNodeBy}
              onAddChild={addChildNode}
            />
          ))}
        </div>
      )}

      <button type="button" className="add-example" onClick={addSection}>
        ＋ add custom tag
      </button>

      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.includeRealInput}
          onChange={(event) =>
            setDraft((current) => ({ ...current, includeRealInput: event.target.checked }))
          }
        />
        末尾に実入力の枠（<code>{"{{INPUT}}"}</code>）を付ける
      </label>

      {variables.length > 0 && (
        <>
          <div className="section-head">
            <h2 className="section-label">variables</h2>
            <span className="section-note">{`{{名前}} と書くとここに現れます`}</span>
          </div>
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
        </>
      )}

      <div className="section-head">
        <h2 className="section-label">Output schema</h2>
        <span className="section-note">structured outputs で出力の形を確実に固定します</span>
      </div>
      <OutputSchemaEditor
        schema={draft.outputSchema}
        effort={draft.effort}
        onChangeSchema={(outputSchema) => setDraft((current) => ({ ...current, outputSchema }))}
        onChangeEffort={(effort: Effort) => setDraft((current) => ({ ...current, effort }))}
      />

      <LintPanel findings={findings} />

      <OutputPanel built={built} outputConfig={outputConfig} />
    </main>
  );
}
