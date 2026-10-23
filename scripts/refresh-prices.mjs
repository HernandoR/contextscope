#!/usr/bin/env node
/**
 * Refresh lib/model-prices.json from LiteLLM's authoritative price list.
 *
 * Pulls https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json,
 * keeps only Anthropic models with the cost fields we use, and merges them into
 * lib/model-prices.json. Models already in the file are never removed (LiteLLM
 * drops retired models, but old sessions still need their prices); LiteLLM
 * values win for any model it lists. Metadata keys (e.g. _supplementalSource)
 * are preserved.
 *
 * Usage: node scripts/refresh-prices.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const HERE = dirname(fileURLToPath(import.meta.url));
const DST = join(HERE, "..", "lib", "model-prices.json");

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const all = await res.json();

let existing = { models: {} };
try {
  existing = JSON.parse(await readFile(DST, "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

const pruned = {};
for (const [name, m] of Object.entries(all)) {
  if (m?.litellm_provider !== "anthropic") continue;
  if (typeof m.input_cost_per_token !== "number") continue;
  const cc5m = m.cache_creation_input_token_cost ?? 0;
  pruned[name] = {
    input: m.input_cost_per_token,
    output: m.output_cost_per_token ?? 0,
    cache_read: m.cache_read_input_token_cost ?? 0,
    cache_creation_5m: cc5m,
    // Anthropic's documented 1hr cache rate is 2x the 5min rate.
    // Fall back to 2x when LiteLLM doesn't list it explicitly.
    cache_creation_1h: m.cache_creation_input_token_cost_above_1hr ?? cc5m * 2,
  };
}

const merged = { ...existing.models, ...pruned };
const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(
  DST,
  JSON.stringify(
    {
      ...existing,
      _source: SRC,
      _refreshedAt: new Date().toISOString(),
      _description: "Anthropic model prices in USD per token (input, output, cache_read, cache_creation 5min default). Refresh with `npm run refresh-prices`.",
      models: sorted,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`wrote ${Object.keys(sorted).length} anthropic models (${Object.keys(pruned).length} from LiteLLM) → ${DST}`);
