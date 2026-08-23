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

## 機能

- 入力に応じたリアルタイム生成（生成ボタンなし）
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
| `lib/useDraftStorage.ts` | localStorage 永続化 + 外部 JSON の正規化 |
| `components/` | ExampleCard / AutoTextarea / OutputPanel |
| `specification/UI.png` | 元になった UI デザイン |
