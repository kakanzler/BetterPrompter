# BetterPrompter

Instruction と example を入力するだけで、XML タグで構造化された Prompt Engineering 済みの
プロンプトを生成する Web App。

指示を先頭に置き、few-shot example を `<input>` / `<thinking>` / `<ideal_output>` に分けて
XML タグで囲む——という定型作業を、手書きせずに組み立てられる。

## 生成されるプロンプト

```
<instructions>
記事を3行で要約してください。
</instructions>

<examples>
<example>
<input>
本文...
</input>
<thinking>
要点は3つ...
</thinking>
<ideal_output>
・...
</ideal_output>
</example>
</examples>

Now here is the real input.

<input>
{{INPUT}}
</input>
```

空のフィールドはタグごと省略される（`thinking` を書かなければ `<thinking>` は出力されない）。
末尾の実入力ブロックはチェックボックスで ON/OFF でき、`{{INPUT}}` を実際の入力に差し替えて使う。

## カスタムタグ

`+ add custom tag` から任意の XML タグを追加でき、`+ 入れ子タグを追加` でいくらでもネストできる。
セクションごとに `examples の前 / 後` を選べるので、背景は前、出力形式は後ろ、と置き分けられる。

```
<instructions>...</instructions>

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

## 機能

- 入力に応じたリアルタイム生成（生成ボタンなし）
- 任意の XML タグを無制限にネストできるカスタムセクション（examples の前後を選択可）
- 入力欄ごとの文字数表示。日本語を含まない英文なら単語数も併記
- ワンクリックコピー、文字数・概算トークン数の表示
- Example の追加 / 削除 / 並べ替え / 折りたたみ
- localStorage による自動保存（リロードしても復元される）
- JSON でのエクスポート / インポート
- 本文に閉じタグ（`</input>` など）が混ざると警告を表示

## 開発

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest（プロンプト組み立てロジックのテスト）
npm run build
```

## 構成

| パス | 役割 |
|---|---|
| `app/page.tsx` | 状態オーナー。下書き全体を保持し、子コンポーネントへ渡す |
| `lib/buildPrompt.ts` | 下書き → プロンプト文字列の純粋関数。出力仕様の単一の真実の源 |
| `lib/tree.ts` | カスタムタグのツリー操作（更新 / 削除 / 並べ替え / 子の追加） |
| `lib/useDraftStorage.ts` | localStorage 永続化 + 外部 JSON の正規化 |
| `components/` | ExampleCard / CustomNodeEditor / AutoTextarea / OutputPanel |
| `specification/UI.png` | 元になった UI デザイン |
