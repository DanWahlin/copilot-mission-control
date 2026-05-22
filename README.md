# 🏰 Kingdom of Agents

A live, medieval-themed dashboard for the [GitHub Copilot CLI](https://github.com/github/copilot-cli). Watch your active Copilot sessions become a living kingdom of tools, agents, and alerts.

Built with [Tauri 2](https://v2.tauri.app/), [Phaser 4](https://phaser.io/), and TypeScript.

🔗 Website: [https://danwahlin.github.io/kingdom-of-agents](https://danwahlin.github.io/kingdom-of-agents)

## What it does

Kingdom of Agents reads the local session state Copilot CLI already writes under `~/.copilot/session-state/` and turns each session into a district in a small medieval kingdom:

| District | What it tracks |
|----------|----------------|
| **Forge** | File writes / `apply_patch` calls |
| **Library** | Reads / search / `view` calls |
| **Terminal Keep** | Shell commands / `bash` calls |
| **Signal Tower** | Web fetches / external lookups |
| **Guild Hall** | Sub-agent (`task`) calls |
| **Tome Hall** | Skill (`skill`) calls |
| **Royal Court** | Permission prompts and alerts |

Only sanitized session summaries cross the renderer bridge — prompts, tool arguments, command output, file paths, and diffs **never** leave the Rust backend.

## Install

Builds for macOS, Windows, and Linux are produced from the [latest GitHub Release](https://github.com/DanWahlin/kingdom-of-agents/releases). The app is not code-signed; see the release notes for platform-specific quarantine/SmartScreen unlock instructions.

## Develop

```bash
npm install
npm start            # builds frontend + launches Tauri dev window
```

Useful commands:

```bash
npm run build:frontend   # tsc + copy HTML/Phaser/assets to dist/
npm run build            # frontend + cargo build
npm test                 # build:frontend + playwright
npx playwright test      # tests only (build:frontend must run first)
cd src-tauri && cargo check
```

The frontend mounts at `dist/game/index.html` and Playwright serves it via `python3 -m http.server 4173 --directory dist`. Phaser runs inside the Tauri webview but is fully testable in plain Chromium because the `__kingdomFixture` global lets tests inject deterministic activity data.

## Architecture (brief)

- **`src-tauri/src/agent.rs`** — `AgentProvider` trait + `CopilotProvider` impl. Scans `~/.copilot/session-state/`, normalizes events, and watches the directory with `notify = 8` so the UI updates within ~300 ms of any change. Returns only allowlisted fields.
- **`src-tauri/src/lib.rs`** — Tauri commands (`get_agent_activity`, `open_in_editor`, etc.) and the tray icon. Uses `tauri-plugin-window-state` to persist window size/position across launches.
- **`src/game/scenes/CodeKingdom.ts`** — the single Phaser scene. Renders districts, ops panel, replay timeline, session inspector, and the Tiny Swords assets in `assets/kingdom/tiny-swords/`.
- **`src/game/game.ts`** — minimal Phaser bootstrap. One scene, opaque background, resizes with the window.
- **`src/game/index.html` + `hud.js`** — slim 32 px top bar with brand and mute toggle. Nothing more.

## Assets

Visuals come from the **CC0 Tiny Swords** archive (Pixel Frog). The curated subset committed under `assets/kingdom/tiny-swords/` includes a `LICENSE.txt` provenance note. Do not mix in the paid (non-redistributable) Tiny Swords pack.

## Releasing

```bash
npm run release 0.2.0
```

`scripts/release.js` bumps `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, regenerates `CHANGELOG.md` via `git-cliff`, commits, tags `v0.2.0`, and pushes. The `Build & Release` workflow then builds installers for all three platforms and attaches them to the GitHub Release.

## License

MIT — see [`LICENSE`](./LICENSE). Tiny Swords assets are CC0 from Pixel Frog.
