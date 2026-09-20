# contextscope

A CLI + local dashboard that audits the **per-turn token context** Claude Code loads on every conversation turn — and gives you toggle-based control to disable what you don't use.

`/stats`, `/cost`, and `ccusage` show **aggregate** spend. None of them break down what's *inside* the per-turn baseline or let you act on the audit. At 1M-context Opus, every unused skill, agent, command, or hook output that lives in the available-list block is paying full cache-read cost on every turn — for a heavy user, that's hundreds of millions of tokens per month.

## Quick look (CLI)

```bash
npx @hernandor/contextscope
```

Prints a 30-day audit to stdout in ~3s. Per-turn baseline, 30-day burn + API-equivalent cost, top disable candidates, context overhead. No browser, no server.

## Full dashboard (browser)

```bash
npx @hernandor/contextscope ui
```

Picks a free port starting at 3939, opens your browser. Adds: toggle-to-disable buttons, per-session drilldown, daily burn graph, by-project breakdown, hook + MCP detail.

Or install globally so the `contextscope` command stays around:

```bash
npm install -g @hernandor/contextscope
contextscope        # quick CLI summary
contextscope ui     # dashboard
```

Flags (ui only):
- `--port <n>` — pin a port
- `--no-open` — don't auto-open the browser
- `--help` — full usage

## Optional: Claude Code slash command

After installing globally, run:

```bash
contextscope install-plugin
```

This copies a `/usage` slash command into `~/.claude/commands/usage.md`. Restart Claude Code, then `/usage` in any session asks Claude to launch the dashboard in the background and report the URL. Remove with `contextscope uninstall-plugin`.

## What it shows

- **Skills, agents, slash commands** (user + plugin) — per-turn description cost + body cost on invocation
- **CLAUDE.md** (global + every project) + **MEMORY.md** (per-project auto-memory) — full token count, where loaded
- **SessionStart + UserPromptSubmit hook output** — dry-run with sample input, output tokenized
- **MCP servers** — direct + PTC-proxied downstream
- **Session analytics** — top expensive sessions, daily burn, cache hit ratio, output:input ratio, p75/p95
- **Invocation counts** per skill/agent over the last 30 days from JSONL transcripts
- **Recommendation engine** — bulk-disable unused user items in one click, surface long-session patterns

## What it does

- Toggles individual user-level skills / agents / commands (renames file with `.disabled` suffix — reversible)
- Toggles whole plugins (flips `enabledPlugins[<plugin>@<marketplace>]` in `~/.claude/settings.json`)
- Backs up `settings.json` before every mutation (`~/.claude/settings.json.usage-bak-<timestamp>`, 5 most recent kept)
- Bulk-disables every user item never invoked in the last 30 days

> **Toggles take effect on the next Claude Code restart** — CC reads skills, agents, commands, and `settings.json` at startup. There's no hot-reload mechanism.

## Known constraint

Plugin-bundled skills/agents (e.g. `superpowers:brainstorming`, `gsd:plan-phase`) **cannot be individually disabled** in Claude Code's current model — you can only toggle the whole plugin. The "By plugin" table handles this; individual plugin items in the main table show `(plugin)` as their toggle status.

## How it measures tokens

Uses [`js-tiktoken`](https://github.com/dqbd/tiktoken) with the `cl100k_base` encoder as a proxy for Anthropic's tokenizer (not publicly released). Expect ~5–10% absolute deviation; relative rankings should be accurate.

## What it can't measure

- The base Claude Code system prompt (built into the binary)
- Tool-call results that compound mid-session
- The `available skills` / `available agents` wrapper blocks the harness adds around your descriptions

## Development

```bash
git clone <repo> contextscope
cd contextscope
npm install
npm run dev       # localhost:3000 — slow page loads from Next.js dev bundling
npm run prod      # build + start in production mode — ~0.6s warm reload
```

Requires Node 18+. macOS/Linux paths; Windows untested but uses `os.homedir()` throughout.

## Releasing

Publishing to npm is automated via [`.github/workflows/publish.yml`](.github/workflows/publish.yml), triggered by pushing a `v*` tag:

1. Bump `version` in `package.json` (PR + merge to `main` as usual).
2. Tag the merge commit and push the tag:
   ```bash
   git tag v0.4.4
   git push origin v0.4.4
   ```
3. The workflow checks out the tag, verifies the tag version matches `package.json`, runs `npm ci`, and publishes with `npm publish --provenance` (which runs `prepublishOnly` → `next build`). Authentication uses npm's [**Trusted Publishing**](https://docs.npmjs.com/trusted-publishers) (OIDC) — no long-lived token is stored in GitHub.

**One-time setup:** npm's Trusted Publisher can only be registered on a package that already exists on the registry, so the very first publish has to be done manually; every release after that goes through CI.

1. First publish (local, one-time) — copy `.env.publish.example` to `.env.publish`, fill in a personal `NPM_TOKEN`, then:
   ```bash
   npm run release
   ```
2. On the newly-created package's npm settings page (`https://www.npmjs.com/package/@hernandor/contextscope/access`), add a **Trusted Publisher** for GitHub Actions:
   - Organization or user: `HernandoR`
   - Repository: `contextscope`
   - Workflow filename: `publish.yml`
   - Environment: leave blank
3. Delete `.env.publish` / revoke that npm token once Trusted Publishing is confirmed working — it was only needed to bootstrap the package.

From then on, releases are just:
```bash
git tag v0.4.4
git push origin v0.4.4
```

## Architecture

- **`lib/transcripts.ts`** — unified single-pass JSONL parser with per-file mtime cache; consumed by `usage.ts` + `sessions.ts`
- **`lib/inventory.ts`** — scans skills, agents, commands; detects `.disabled` siblings; reads `enabledPlugins`
- **`lib/usage.ts`** — invocation counts per skill/agent from transcripts
- **`lib/sessions.ts`** — per-session token aggregation + summary stats
- **`lib/files.ts`** — CLAUDE.md + MEMORY.md scanner with denylist for dependency-bundled noise
- **`lib/hooks.ts`** — reads settings.json hooks, parallel dry-runs SessionStart + UserPromptSubmit
- **`lib/mcp.ts`** — reads `.claude.json` mcpServers, parses PTC's downstream config.yaml
- **`app/actions.ts`** — server actions for toggles + bulk disable; backs up settings before write
- **`app/page.tsx`** — single server-rendered page; filesystem re-read on every load (cached internally)
- **`bin/cli.js`** — CLI entry: routes to `summary.js` (default) or launches the Next.js dashboard (`ui` subcommand)
- **`bin/summary.js`** — pure-JS CLI summary; mirrors the lib/* logic without Next.js for the fast first-impression printout

## Credits

Originally created by [Maximus Beato](https://github.com/mbeato) as [`mbeato/contextscope`](https://github.com/mbeato/contextscope). This fork is maintained at `@hernandor/contextscope` under the same MIT license; see [LICENSE](LICENSE) for the original copyright notice.

## License

MIT
