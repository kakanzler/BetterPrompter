# BetterPrompter

Prompt Engineering の定番手法を、手書きせずに組み立てられる Web App。

指示を先頭に置き、few-shot example を `<input>` / `<thinking>` / `<ideal_output>` に分けて
XML タグで囲む——といった定型作業を UI で埋めるだけで、Messages API の
**System / User / Assistant(prefill)** に対応した形で出力される。

## 生成されるプロンプト

```
[system]
あなたは経験豊富な編集者です。

[user]
<documents>
<document index="1">
<source>report.md</source>
<document_content>
2024年の売上は前年比12%増。
</document_content>
</document>
</documents>

<instructions>
記事を3行で要約してください。
</instructions>

<thinking_instructions>
回答する前に <thinking> タグの中で段階的に考えてください。
考えがまとまったら <answer> タグの中に最終的な回答だけを書いてください。
</thinking_instructions>

<constraints>
- 200字以内
- 敬体で書く
</constraints>

<examples>
<example>
<input>
本文...
</input>
<ideal_output>
・...
</ideal_output>
</example>
</examples>

<negative_examples>
<negative_example>
<input>
同じ本文
</input>
<why_wrong>
要点を列挙せず感想になっている
</why_wrong>
<bad_output>
すごく良い記事でした
</bad_output>
</negative_example>
</negative_examples>

Now here is the real input.

<input>
{{INPUT}}
</input>

[assistant]
<analysis>
```

空のフィールドはタグごと省略される（`thinking` を書かなければ `<thinking>` は出力されない）。
末尾の実入力ブロックはチェックボックスで ON/OFF でき、`{{INPUT}}` を実際の入力に差し替えて使う。

## 機能

### プロンプトの組み立て

- **Role / System** — 役割を system ターンに渡す
- **Instruction** — やってほしいことを先頭に置く
- **Chain-of-Thought トグル** — `<thinking>` で考えてから `<answer>` で答えるよう定型指示を挿入
- **constraints** — 守ってほしい条件を箇条書きで `<constraints>` に構造化
- **documents** — 長文資料を Anthropic 推奨の `<document index="N">` 形式でプロンプト先頭に配置
- **long-context モード** — 資料が長いとき、指示を example の後ろ（末尾寄り）へ移す
- **example（良い例 / 悪い例）** — 悪い例は `<negative_examples>` に分け、
  フィールドを `<why_wrong>` / `<bad_output>` に読み替える
- **custom tags** — 任意の XML タグを無制限にネスト（examples の前後を選択可）
- **Assistant prefill** — 応答の書き出しを固定して形式を強制する
- **variables** — `{{名前}}` を自動検出し、テスト値を当てた完成形をプレビュー

### 支援機能

- **チェック（Lint）** — example が少ない、出力形式が未指定、prefill が空白で終わっている等を指摘
- 役割ごとの Copy と「全部まとめてコピー」
- セクション別のトークン内訳（概算）
- 入力欄ごとの文字数表示。日本語を含まない英文なら単語数も併記
- localStorage による自動保存（リロードしても復元される）
- JSON でのエクスポート / インポート（古い形式の JSON もそのまま読める）
- 本文に閉じタグ（`</input>` など）が混ざると警告を表示

## カスタムタグ

`+ add custom tag` から任意の XML タグを追加でき、`+ 入れ子タグを追加` でいくらでもネストできる。
セクションごとに `examples の前 / 後` を選べるので、背景は前、出力形式は後ろ、と置き分けられる。

```
<context>                       ← examples の「前」
  <project>
    BetterPrompter という Next.js アプリ
  </project>
</context>

<examples>...</examples>

<output_format>                 ← examples の「後」
  マークダウンの箇条書き
</output_format>
```

タグ名は XML の要素名として使える形に自動整形される（`output format` → `output_format`、
数字始まりには `_` を補う）。書き換わる場合は入力欄の横に実際に出力されるタグを表示する。
タグ名が空、あるいは本文も入れ子も空のノードは出力から丸ごと落ちる。

## 開発

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build
```

## 構成

| パス | 役割 |
|---|---|
| `app/page.tsx` | 状態オーナー。下書き全体を保持し、子コンポーネントへ渡す |
| `lib/buildPrompt.ts` | 下書き → System/User/Assistant の純粋関数。出力仕様の単一の真実の源 |
| `lib/lint.ts` | 下書きの静的チェック。外部通信もモデル呼び出しもしない |
| `lib/variables.ts` | `{{VAR}}` の検出とテスト値の適用 |
| `lib/tree.ts` | カスタムタグのツリー操作（更新 / 削除 / 並べ替え / 子の追加） |
| `lib/useDraftStorage.ts` | localStorage 永続化 + 外部 JSON の正規化（旧形式との互換もここ） |
| `components/` | ExampleCard / DocumentCard / CustomNodeEditor / ConstraintList / VariablePanel / LintPanel / AutoTextarea / OutputPanel |
| `specification/UI.png` | 元になった UI デザイン |
