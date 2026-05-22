# AGENTS.md

## Project Overview

Kingdom of Agents is a windowed, decorated, resizable Tauri 2 desktop app that visualizes live activity from the [GitHub Copilot CLI](https://github.com/github/copilot-cli). It runs as an opaque normal-level window (not an overlay) so devs can park it on a second monitor while interacting with Copilot CLI in their primary terminal.

The product was extracted from the [Agent Arcade](https://github.com/DanWahlin/agent-arcade) monorepo at v0.1.0 and now lives standalone.

## Repository Structure

```
src/game/                — Frontend code (TypeScript, Phaser 4)
src/game/scenes/         — Phaser scenes
  CodeKingdom.ts         — The product. One scene; the entire dashboard
  viewport.ts            — W/H exports + refreshDimensions() (resize helper)
src/game/game.ts         — Single-scene Phaser bootstrap (~55 lines)
src/game/index.html      — Slim 32 px top bar + #game div
src/game/hud.js          — Mute toggle (M key) + Phaser master mute
src-tauri/               — Tauri 2 Rust backend
  src/lib.rs             — Tauri commands + tray + window-state plugin
  src/agent.rs           — AgentProvider trait + CopilotProvider + fs watcher
  tauri.conf.json        — Windowed, decorated, resizable, opaque, 1280×800
assets/kingdom/          — Curated CC0 Tiny Swords subset (with LICENSE.txt)
docs/                    — GitHub Pages site (single-page placeholder)
scripts/release.js       — Version bump + git-cliff + tag + push
tests/                   — Playwright (Chromium, headless)
  app.spec.ts            — App shell smoke tests
  code-kingdom.spec.ts   — Scene behavior + multi-viewport layout regressions
  helpers.ts             — waitForGame() + getKingdomStatus()
.github/workflows/
  build.yml              — Build & Release on v* tags
  ci.yml                 — type-check + build + Playwright on PRs
  deploy-pages.yml       — docs/ → GitHub Pages on push to main
```

## Tech Stack

- **Desktop shell:** Tauri 2 — decorated, resizable, opaque window. Tray icon with Show/Hide and Quit. Window size and position persisted via `tauri-plugin-window-state`.
- **Frontend:** Phaser 4 (Graphics + Image sprites), TypeScript (ES2022, strict, `verbatimModuleSyntax: true`, `.js` import extensions).
- **Backend:** Rust 2021. Owns `~/.copilot/session-state/` scanning, normalization, allowlisting, and the `notify = 8` filesystem watcher that pushes updates to the renderer via `window.__koaOnAgentActivityChanged()` calls.
- **Tests:** Playwright headless Chromium. The renderer is fully testable without Tauri because `window.__kingdomFixture` lets a test inject deterministic activity data.

## Build & Run

```bash
npm install                # install deps + regenerate package-lock
npm run build:frontend     # tsc + copy HTML/Phaser/assets to dist/
npm run build              # frontend + cargo build
npm start                  # frontend + cargo tauri dev (launches the window)
```

## Testing

```bash
npm test                                       # full suite (build + Playwright)
npx playwright test tests/code-kingdom.spec.ts # scene tests only
npx playwright test --headed                   # visible browser
```

The Playwright `webServer` config serves `dist/` over `python3 -m http.server 4173`. The current suite is **19 tests** covering startup, dashboard panels, replay/scrubber, session selection, ops mode classification, and a six-viewport layout regression.

## Key Patterns

- **`CodeKingdomScene` extends `Phaser.Scene` directly.** There is no `BaseScene`. The scene paints its own full-window backdrop in `create()` (depth -100) and redraws it on `scale.resize`.
- **Single scene.** Boot Phaser → instantiate `CodeKingdomScene` → resize listener calls `refreshDimensions()` + `scale.resize(W, H)` so the scene re-lays-out the dashboard on every window change.
- **Push-driven updates.** The Rust watcher debounces FS events (~300 ms) and calls `win.eval("window.__koaOnAgentActivityChanged && window.__koaOnAgentActivityChanged()")`. The 30 s poll in the scene is a fallback for environments where the watcher fails to attach.
- **Privacy invariant.** The `AgentProvider::scan()` boundary is the only place where Copilot session data is read. Only allowlisted fields cross into `AgentEventSummary` / `AgentSessionSummary` — never raw prompts, tool args, command output, file paths, or diffs.
- **`window.__codeKingdom`** exposes `getStatus()` / `saveSnapshot()` / `restartReplay()` / `clearCurrent()` / `clearAll()` / `disconnect()` for the top bar and for tests. The HUD also keeps these accessible because the original scene-aware HUD pattern survived the extraction.
- **`window.__phaserGame`** is set so Playwright can reach into the scene registry without DOM scraping.
- **LocalStorage keys** are prefixed `koa_` (e.g., `koa_muted`, `koa_prefs`).

## Adding a Provider

The whole point of the `AgentProvider` trait is making this cheap. To add Claude Code, Codex, or a custom CLI:

1. Implement a `ClaudeCodeProvider` struct in `src-tauri/src/agent.rs` (or its own module) with `id()`, `label()`, `is_available()`, `state_root()`, and `scan() -> ProviderScan`.
2. In `scan()`, walk the provider's local state directory (`~/.claude/projects/<project>/<sid>.jsonl`, `~/.codex/sessions/<id>/`, etc.) and build `AgentSessionSummary` / `AgentToolMetric` / `AgentEventSummary` records. **Allowlist fields** — no raw prompts/args/output/paths/diffs.
3. Set `provider: "claude"` (or similar) on each summary so the renderer can color/icon-differentiate later.
4. Add the provider to `default_providers()`.

The watcher automatically attaches to each provider's `state_root()`, the merger handles top-N truncation globally across providers, and the renderer is provider-agnostic.

## Releasing

```bash
npm run release <version>    # e.g. npm run release 0.2.0
```

`scripts/release.js`:

1. Bumps version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Regenerates `CHANGELOG.md` from git via `git-cliff` (config: `cliff.toml`).
3. Commits everything, creates a `v<version>` tag, and pushes to `origin`.
4. The `Build & Release` workflow takes over: builds macOS (universal), Windows, and Linux installers, then attaches them to the GitHub Release.

All three version files must be updated together for installer filenames to be correct — the script does this automatically.

## What was intentionally dropped during extraction

The original Agent Arcade source had ~750 lines of `lib.rs` and an 820-line `BaseScene`. Most of that was supporting things Kingdom of Agents does not need:

- Transparent always-on-top + click-through window (replaced with normal decorated window).
- Global shortcut registration (no need to keybind from outside the focused window).
- Five other game scenes + scene switcher + game selector.
- Score / lives / level / high-score HUD primitives.
- Pause/resume/help/settings overlays.
- The Tauri updater plugin and signing key plumbing (v0.1.0 does not auto-update).

If any of these are needed later, port them back deliberately — but keep the trim app shell as the default.
