# AI Werewolf Arena

> A multi-LLM adversarial gaming platform — pit different AI models against each other in Werewolf (Mafia) rules, with spectators watching every game in real time from a god's-eye view.

**Version**: 0.1.2 · **Stack**: TypeScript · Fastify + Socket.IO · React + Vite + Tailwind · SQLite (sql.js)

[中文版](README.md)

---

## Why This Project

I saw AI Werewolf battles on Bilibili and thought they were great fun. Being able to freely choose the models and customize the rules would make it even better.

There was no ready-made software out there, so I built my own and open-sourced it for everyone.

Have fun!

## Features

- Bind a different AI model to each seat — one API config (endpoint + key) can host multiple models, with pull/select management and one-click random assignment
- Full Werewolf rules: Seer / Witch / Hunter / Idiot / Werewolf / Villager, including sheriff election, last words, hunter's shot, and badge handover
- God's-eye live spectating (speeches / votes / reasoning visible), with game replays
- Board presets + custom roles, compatible with any OpenAI-format API (key can be left blank for local services)

## Quick Start

```bash
npm install
npm run db:init       # initialize database on first run
npm run dev:server    # backend :3001
npm run dev:client    # frontend :5173 (another terminal)
```

Windows scripts: `start.bat` (start) · `shutdown.bat` (shutdown) · `restart-server.bat` (restart backend)

## Usage

1. **Model Management** → add an API config (name / endpoint / key) → fetch models → select the ones to use
2. **Game Config** → pick a board → assign a model to each seat (or 🎲 random) → start the game
3. Watch the match live on the **Spectator Stand**

## Development

```bash
npm run lint       # type check
npx vitest run     # tests
```

Architecture: monorepo (`shared` shared types / `server` Fastify engine + rules engine + LLM scheduler / `client` React frontend).
Add roles: `server/src/engine/roles.ts` + `handlers/`; add boards: admin UI or `db/seed-roles.ts`.

## Changelog

> Only the latest 3 versions are shown here. Full history: [CHANGELOG.md](CHANGELOG.md)

### 0.1.2 (2026-08-01)

- 🎮 **Game control fixes**: pause/resume/stop now truly work (pause freezes instantly, resume resumes correctly, stop halts immediately), aborts in-flight AI calls on stop, frontend shows a "game terminated" toast
- 🎨 **Mobile-game style UI**: dark starry-night ambience + gold accent, glassmorphism cards, hand-drawn linear SVG role totems (zero emoji), day/night ambience on the spectator stage + gamified timeline, identity hidden for spectators
- 🌙 **Dynamic wallpapers**: two built-in pure-CSS wallpapers ("Starry Night", "Full Moon"), custom image/GIF upload supported
- 🔤 **Custom fonts**: font picker + custom font-family input, applies instantly
- 🔧 **Self-adaptive launch scripts**: start.ps1/shutdown.ps1 now use $PSScriptRoot, work directly from any worktree

### 0.1.1 (2026-08-01)

- 📦 **Portable build**: single-file executable, extract-and-play, no Node.js required (server serves the frontend and opens the browser automatically)
- ⏻ **Clean exit**: red "Exit" button in the top-right of the page (saves the database before exiting), or close the black console window

### 0.1.0 (2026-08-01)

- 🎮 Full Werewolf rules engine: 16-phase state machine + 12 roles (Seer/Witch/Hunter/Idiot/Werewolf/Villager, incl. sheriff, last words, hunter shot, badge handover)
- 🤖 Multi-LLM battles: each seat independently bound to an AI model, parallel scheduling + three-layer prompts + cross-game memory
- 🗂️ Model management: one API config hosting multiple models (pull/select), one-click random assignment
- 👁️ Admin console + spectator stand: god's-eye live view, game replays
- 🧩 Board presets & custom roles (6/9/12 players, total-kill / faction-kill / no-sheriff variants)
- 🔌 Compatible with any OpenAI-format API (Ollama etc., key optional)

## Disclaimer

This project is entirely AI-written. The code has not been reviewed by humans; it has been tested and works, but use at your own risk.

## License

[MIT](LICENSE)
