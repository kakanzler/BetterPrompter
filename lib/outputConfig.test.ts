import { describe, expect, it } from "vitest";
import { buildOutputConfig, parseSchema, SCHEMA_TEMPLATE } from "./outputConfig";
import { defaultDraft } from "./types";
import type { PromptDraft } from "./types";

function draft(overrides: Partial<PromptDraft> = {}): PromptDraft {
  return { ...defaultDraft(), ...overrides };
}

describe("parseSchema", () => {
  it("空文字列と空白だけは empty", () => {
    expect(parseSchema("").status).toBe("empty");
    expect(parseSchema("   \n ").status).toBe("empty");
  });

  it("正しい JSON オブジェクトは ok", () => {
    const state = parseSchema('{"type":"object"}');
    expect(state.status).toBe("ok");
    expect(state.status === "ok" && state.value).toEqual({ type: "object" });
  });

  it("雛形はそのまま通る", () => {
    expect(parseSchema(SCHEMA_TEMPLATE).status).toBe("ok");
  });

  it("壊れた JSON は error", () => {
    const state = parseSchema("{ type: object }");
    expect(state.status).toBe("error");
    expect(state.status === "error" && state.message.length).toBeGreaterThan(0);
  });

  it("配列やスカラーは error", () => {
    expect(parseSchema("[1,2]").status).toBe("error");
    expect(parseSchema("true").status).toBe("error");
    expect(parseSchema('"文字列"').status).toBe("error");
    expect(parseSchema("null").status).toBe("error");
  });
});

describe("buildOutputConfig", () => {
  it("指定が何も無ければ null", () => {
    expect(buildOutputConfig(draft())).toBeNull();
  });

  it("effort だけなら format キーを出さない", () => {
    const config = JSON.parse(buildOutputConfig(draft({ effort: "high" }))!);
    expect(config).toEqual({ effort: "high" });
  });

  it("スキーマだけなら effort キーを出さない", () => {
    const config = JSON.parse(buildOutputConfig(draft({ outputSchema: '{"type":"object"}' }))!);
    expect(config).toEqual({ format: { type: "json_schema", schema: { type: "object" } } });
  });

  it("両方あれば両方出す", () => {
    const config = JSON.parse(
      buildOutputConfig(draft({ effort: "max", outputSchema: '{"type":"object"}' }))!,
    );
    expect(config).toEqual({
      effort: "max",
      format: { type: "json_schema", schema: { type: "object" } },
    });
  });

  it("effort が「指定しない」ならキーごと出さない", () => {
    expect(buildOutputConfig(draft({ effort: "", outputSchema: '{"type":"object"}' }))).not.toContain(
      "effort",
    );
  });

  it("壊れたスキーマは出力に含めない", () => {
    expect(buildOutputConfig(draft({ outputSchema: "{ 壊れている" }))).toBeNull();
  });

  it("壊れたスキーマでも effort があればそれだけ出す", () => {
    const config = JSON.parse(
      buildOutputConfig(draft({ effort: "low", outputSchema: "{ 壊れている" }))!,
    );
    expect(config).toEqual({ effort: "low" });
  });

  it("読みやすいよう2スペースで整形する", () => {
    expect(buildOutputConfig(draft({ effort: "high" }))).toBe('{\n  "effort": "high"\n}');
  });
});
