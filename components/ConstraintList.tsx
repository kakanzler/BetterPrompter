"use client";

import { useRef } from "react";

type Props = {
  constraints: string[];
  onChange: (constraints: string[]) => void;
};

export default function ConstraintList({ constraints, onChange }: Props) {
  // 追加直後の行にフォーカスを移すため、最後の入力欄を覚えておく。
  const lastRef = useRef<HTMLInputElement>(null);

  function update(index: number, value: string) {
    onChange(constraints.map((item, i) => (i === index ? value : item)));
  }

  function remove(index: number) {
    onChange(constraints.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= constraints.length) return;
    const next = [...constraints];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...constraints, ""]);
    // state 更新後に描画される行を掴みたいので、次のフレームまで待つ。
    requestAnimationFrame(() => lastRef.current?.focus());
  }

  return (
    <div className="constraint-list">
      {constraints.map((item, index) => (
        <div className="constraint-row" key={index}>
          <span className="bullet" aria-hidden="true">
            -
          </span>
          <input
            ref={index === constraints.length - 1 ? lastRef : undefined}
            className="constraint-input"
            value={item}
            placeholder="守ってほしいこと（例: 200字以内）"
            aria-label={`制約 ${index + 1}`}
            onChange={(event) => update(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`制約 ${index + 1} を上へ移動`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`制約 ${index + 1} を下へ移動`}
            disabled={index === constraints.length - 1}
            onClick={() => move(index, 1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`制約 ${index + 1} を削除`}
            onClick={() => remove(index)}
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" className="add-child" onClick={add}>
        ＋ 制約を追加
      </button>
    </div>
  );
}
