"use client";

import { useState } from "react";

type Props = {
  droppedPrefill: string;
};

/** prefill の用途別に、現行 Claude での正しい置き換え先。 */
const REPLACEMENTS: { use: string; replacement: string }[] = [
  { use: "JSON / スキーマ形式を強制していた", replacement: "下の Output schema に JSON Schema を書く" },
  { use: "分類ラベルを強制していた", replacement: "enum を持つ Output schema にする" },
  { use: "前置きを省かせていた", replacement: "Role / System に「前置きなしで直接答える」と書く" },
  { use: "中断した応答の続きを書かせていた", replacement: "Instruction に「直前の応答は〜で切れた。続きを書いて」と書く" },
  { use: "リマインダを注入していた", replacement: "Instruction かカスタムタグに入れる" },
];

export default function MigrationNotice({ droppedPrefill }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="migration-notice" role="status">
      <div className="migration-head">
        <strong>保存されていた Assistant prefill を外しました</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="この通知を閉じる"
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
      </div>

      <p className="migration-body">
        現行の Claude（Opus 5 / Sonnet 5 / Fable 5 / 4.6 以降）は、応答の先頭を固定する
        prefill を <strong>400 エラー</strong>で拒否します。そのため BetterPrompter から
        この機能を外しました。保存されていた内容は以下です — 必要なら控えてください。
      </p>

      <pre className="migration-content">{droppedPrefill}</pre>

      <table className="migration-table">
        <thead>
          <tr>
            <th>prefill の用途</th>
            <th>現行 Claude での代替</th>
          </tr>
        </thead>
        <tbody>
          {REPLACEMENTS.map((row) => (
            <tr key={row.use}>
              <td>{row.use}</td>
              <td>{row.replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
