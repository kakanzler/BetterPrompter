"use client";

import { useMemo, useRef } from "react";
import AutoTextarea from "@/components/AutoTextarea";
import ExampleCard from "@/components/ExampleCard";
import OutputPanel from "@/components/OutputPanel";
import { buildPrompt } from "@/lib/buildPrompt";
import { emptyExample, type Example } from "@/lib/types";
import { normalizeDraft, useDraftStorage } from "@/lib/useDraftStorage";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Page() {
  const [draft, setDraft] = useDraftStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => buildPrompt(draft), [draft]);

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
    setDraft((current) => {
      const index = current.examples.findIndex((example) => example.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.examples.length) return current;
      const examples = [...current.examples];
      [examples[index], examples[target]] = [examples[target], examples[index]];
      return { ...current, examples };
    });
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
      if (restored) setDraft(restored);
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

      <AutoTextarea
        label="Instruction"
        value={draft.instruction}
        rows={3}
        placeholder="モデルにやってほしいことを書く（例: 記事を3行で要約してください）"
        onChange={(instruction) => setDraft((current) => ({ ...current, instruction }))}
      />

      <div className="section-head">
        <h2 className="section-label">example</h2>
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

      <OutputPanel prompt={prompt} />
    </main>
  );
}
