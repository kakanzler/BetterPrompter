"use client";

type Props = {
  variables: string[];
  values: Record<string, string>;
  previewEnabled: boolean;
  onChangeValue: (name: string, value: string) => void;
  onTogglePreview: (enabled: boolean) => void;
};

export default function VariablePanel({
  variables,
  values,
  previewEnabled,
  onChangeValue,
  onTogglePreview,
}: Props) {
  return (
    <div className="variable-panel">
      <label className="toggle">
        <input
          type="checkbox"
          checked={previewEnabled}
          onChange={(event) => onTogglePreview(event.target.checked)}
        />
        テスト値を当てはめてプレビューする
      </label>

      <div className="variable-rows">
        {variables.map((name) => (
          <div className="variable-row" key={name}>
            <code className="variable-name">{`{{${name}}}`}</code>
            <input
              className="variable-input"
              value={values[name] ?? ""}
              placeholder="テスト値（空ならそのまま残る）"
              aria-label={`${name} のテスト値`}
              onChange={(event) => onChangeValue(name, event.target.value)}
            />
          </div>
        ))}
      </div>

      <p className="variable-note">
        テスト値はプレビュー表示だけに使われ、下書き本体は書き換えません。
      </p>
    </div>
  );
}
