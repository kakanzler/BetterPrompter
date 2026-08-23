# BetterPrompter

Prompt Engineering の定番手法を、手書きせずに組み立てられる Web App。

指示を先頭に置き、few-shot example を `<input>` / `<thinking>` / `<ideal_output>` に分けて
XML タグで囲む——といった定型作業を UI で埋めるだけで、Messages API の
**System / User** ターンと **output_config** に対応した形で出力される。

**現行の Claude（Opus 5 / Sonnet 5 / Fable 5 / 4.6 以降）を前提にしています。**
出力そのものは XML なので他社モデルにも貼れますが、`output_config` は Claude 固有の
API パラメータで、long-context モードの並べ替えも Anthropic のガイダンスに沿っています
（OpenAI は逆に「指示は先頭」を推奨）。

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
```

`output_config` は別ブロックとして、そのまま API に渡せる形で出る:

```json
{
  "effort": "high",
  "format": {
    "type": "json_schema",
    "schema": { "type": "object", "properties": { "summary": { "type": "string" } } }
  }
}
```

空のフィールドはタグごと省略される（`thinking` を書かなければ `<thinking>` は出力されない）。
末尾の実入力ブロックはチェックボックスで ON/OFF でき、`{{INPUT}}` を実際の入力に差し替えて使う。

## 機能

### プロンプトの組み立て

- **Role / System** — 役割を system ターンに渡す
- **Instruction** — やってほしいことを先頭に置く
- **constraints** — 守ってほしい条件を箇条書きで `<constraints>` に構造化
- **documents** — 長文資料を Anthropic 推奨の `<document index="N">` 形式でプロンプト先頭に配置
- **long-context モード** — 資料が長いとき、指示を example の後ろ（末尾寄り）へ移す
- **example（良い例 / 悪い例）** — 既定は0件で、必要なときに足す。
  悪い例は `<negative_examples>` に分け、フィールドを `<why_wrong>` / `<bad_output>` に読み替える。
  `<thinking>`（悪い例では「なぜダメか」）も既定では出さず、`＋` で足す形
- **custom tags** — 任意の XML タグを無制限にネスト（examples の前後を選択可）
- **Output schema** — structured outputs（`output_config.format`）で出力の形を確実に固定する。
  `effort` で思考の深さも指定できる
- **variables** — `{{名前}}` を自動検出し、テスト値を当てた完成形をプレビュー

### 画面

左が入力、右が生成結果と Copy ボタン。右カラムは貼り付いて追従するので、
書きながら出力を見られる。900px 以下では1カラムに折り返す。

### 支援機能

- **チェック（Lint）** — example が少ない、出力形式が未指定、スキーマが壊れている等を指摘。
  まだ何も書いていないうちは何も出さない
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
| `lib/buildPrompt.ts` | 下書き → System / User の純粋関数。出力仕様の単一の真実の源 |
| `lib/lint.ts` | 下書きの静的チェック。外部通信もモデル呼び出しもしない |
| `lib/outputConfig.ts` | JSON Schema の検証と `output_config` の組み立て |
| `lib/variables.ts` | `{{VAR}}` の検出とテスト値の適用 |
| `lib/tree.ts` | カスタムタグのツリー操作（更新 / 削除 / 並べ替え / 子の追加） |
| `lib/useDraftStorage.ts` | localStorage 永続化 + 外部 JSON の正規化（旧形式との互換もここ） |
| `components/` | ExampleCard / DocumentCard / CustomNodeEditor / ConstraintList / OutputSchemaEditor / VariablePanel / LintPanel / MigrationNotice / AutoTextarea / OutputPanel |
| `specification/UI.png` | 元になった UI デザイン |

## Assistant prefill を外した理由

以前は応答の先頭を固定する Assistant prefill 欄があったが、**現行の Claude では
最終 assistant ターンの prefill が 400 エラーになる**（Fable 5 / Opus 5 / Sonnet 5 /
Opus 4.6・4.7・4.8 / Sonnet 4.6。Haiku 4.5 と 4.5 以前では今も有効）。
壊れたプロンプトを作らせないよう機能ごと撤去し、用途別の代替を用意した。

| prefill の用途 | 代替 |
|---|---|
| JSON / スキーマ形式を強制 | **Output schema**（`output_config.format`） |
| 分類ラベルを強制 | enum を持つ Output schema |
| 前置きを省かせる | Role / System に「前置きなしで直接答える」と書く |
| 中断した応答の続き | Instruction に「直前の応答は〜で切れた。続きを書いて」と書く |
| リマインダの注入 | Instruction かカスタムタグに入れる |

prefill 入りの下書きを読み込むと、内容を提示したうえでこの対応表を出す移行通知が表示される。

同様に、Chain-of-Thought の `<thinking>` 指示も撤去した。現行モデルは内部で思考するため
定型文は冗長で、Anthropic のプロンプト監査でも「古いパターン」に分類されている。
思考の深さは prose ではなく `effort` で指定する。

example の `<thinking>` 欄も既定では出さない。使いたいときだけ `＋ thinking を追加` で足す。
`chainOfThought` を持つ古い下書きを読み込んでも壊れず、その項目は無視される。
