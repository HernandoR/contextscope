// Run: npx tsx --test lib/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { costForUsage, type Usage } from "./pricing";

// USD per million tokens, verified against Anthropic's pricing on 2026-09-22:
// https://platform.claude.com/docs/en/about-claude/pricing
for (const [model, rates] of [
  ["claude-fable-5-1", [10, 50, 0.25, 12.5, 20]],
  ["claude-opus-5-5", [4, 20, 0.2, 5, 8]],
] as const) {
  test(`${model} charges published rates without an unknown-model warning`, (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const fields: (keyof Usage)[] = [
      "input", "output", "cacheRead", "cacheCreation5m", "cacheCreation1h",
    ];
    for (const [index, field] of fields.entries()) {
      const usage: Usage = {
        input: 0, output: 0, cacheRead: 0, cacheCreation5m: 0, cacheCreation1h: 0,
      };
      usage[field] = 1_000_000;
      assert.ok(Math.abs(costForUsage(model, usage) - rates[index]) < 1e-10, field);
    }
    assert.equal(warn.mock.callCount(), 0);
  });
}
