# Perssua Clone — Project Context

> Auto-loaded by Claude Code from this folder. Contains all decisions, architecture
> and immediate next steps so we can pick up exactly where we stopped.

## Mission

Build a **real-time AI meeting copilot** — a local clone of [perssua.com](https://perssua.com).
The app listens to my online meetings (Zoom / Meet / Teams), transcribes both me
and the other side, and on demand (or continuously) gives me suggestions,
arguments, translations and summaries via an LLM.

**Constraints**
- Solo dev (me), full-time.
- macOS first (Apple Silicon, my machine), **Windows planned later** — every
  decision must make Windows expansion cheap (mostly: keep platform-specific
  code isolated in a "sidecar" so the JS layer stays cross-platform).
- **Personal use only** at this stage. No distribution, no auth, no billing,
  no telemetry. Self-signed builds. All features open.
- **Cost budget: $0/month operational.** Use free tiers (Gemini API free tier
  or local Ollama) and on-device Apple frameworks where possible.
- Estimated build time: **14–16 weeks full-time.**

## Stack — locked in

| Layer | Choice | Rationale |
|---|---|---|
| Shell | **Electron 33+** | Biggest ecosystem; `setContentProtection` works on macOS (`NSWindow.sharingType=.none`) AND Windows (`SetWindowDisplayAffinity`) — single API, cross-platform stealth. AI coding assistants are strongest in Node/TS. |
| Build/scaffold | **electron-vite** | Modern Vite-based, hot reload for both main and renderer, opinionated and clean. |
| UI | **React + TypeScript** | Skills I already have. |
| Styling | **Tailwind CSS** | Fast iteration. |
| Components | **shadcn/ui** (later, when settings UI is built) | Copy-paste, no dep lock-in. |
| State | **Zustand** | Simpler than Redux, perfect for solo. |
| LLM client | **Vercel AI SDK** (`ai` + `@ai-sdk/google`, `@ai-sdk/openai`, etc.) | Unified API across OpenAI, Anthropic, Gemini, Ollama. Streaming SSE built in. Lives in main process (API keys never touch renderer). |
| Storage — keys | **keytar** | Keychain on macOS, Credential Vault on Windows. |
| Storage — settings | **electron-store** | Encrypted JSON. |
| Storage — sessions | **better-sqlite3** | Local, fast, cross-platform. |
| Hotkeys | Electron `globalShortcut` | Built-in, cross-platform. |
| Audio capture | **Swift sidecar** (NOT Node native module) | Standalone Swift CLI spawned by Electron via `child_process`. Communicates via stdin/stdout JSON. Easier to debug, easier to swap for a Windows equivalent (C# / Rust) speaking the same protocol. |
| STT (mac) | **Apple Speech framework** | Free, on-device, no API key, multilingual. Lives inside the Swift sidecar. |
| Translation | **Apple Translation framework** (macOS 14+) | Free, on-device. Fallback to LLM. |
| Provider abstraction | `TranscriptionProvider` / `AnalysisProvider` / `TranslationProvider` interfaces | Plug-and-play to swap models from Settings UI. |
| Packaging | **electron-builder** (later) | Standard. |
| Auto-update | **electron-updater** (later, only when distributing) | GitHub Releases as backend, free. |

### Stack rejected and why

- **Tauri** — Rust core too steep for solo with no Rust experience.
- **React Native macOS/Windows** — same amount of native code as Electron but smaller ecosystem of desktop modules. Worst of both worlds.
- **Native Swift only** — beautiful Mac app but doubles the work when Windows enters scope. Not aligned with cross-platform goal.
- **Electron native modules (NAPI) for audio** — too much pain for a solo dev with no native dev background. Sidecar pattern wins on debuggability.

## Architecture

```
perssua/
├── package.json
├── tsconfig.json
├── electron.vite.config.ts
├── tailwind.config.js
├── postcss.config.js
│
├── src/
│   ├── main/                          # Node, Electron main process
│   │   ├── index.ts                   # bootstrap, hotkeys, app lifecycle
│   │   ├── window/StealthWindow.ts    # BrowserWindow + setContentProtection
│   │   ├── audio/SidecarManager.ts    # spawns Swift sidecar, JSON protocol
│   │   ├── llm/
│   │   │   ├── providers/             # openai.ts, anthropic.ts, google.ts, ollama.ts
│   │   │   └── AnalysisService.ts     # orchestrates prompt + streaming
│   │   ├── profiles/PromptProfiles.ts # Sales, Tech Interview, LeetCode, English Coach, …
│   │   ├── store/                     # keytar + electron-store wrappers
│   │   └── ipc/                       # typed IPC handlers (consider tRPC-electron)
│   │
│   ├── preload/
│   │   ├── index.ts                   # contextBridge exposing typed `window.api`
│   │   └── index.d.ts                 # global type augmentation
│   │
│   └── renderer/                      # React + TS UI
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── pages/Settings/        # Modelos, Áudio, Permissões, Atalhos, Privacidade
│           ├── pages/Overlay/         # the floating suggestion window
│           ├── stores/                # Zustand
│           ├── components/            # shadcn-based later
│           └── index.css              # Tailwind directives
│
├── sidecars/
│   └── audio-engine/                  # Swift Package, standalone CLI
│       ├── Package.swift
│       └── Sources/
│           ├── main.swift             # stdin/stdout JSON protocol
│           ├── AudioCapture.swift     # ScreenCaptureKit (system audio) + AVAudioEngine (mic)
│           ├── Transcription.swift    # Apple Speech framework wrapper
│           └── Protocol.swift         # message schemas
│
└── (future) sidecars/audio-engine-win/  # C# (.NET) or Rust, same JSON protocol
```

### Two key contracts

1. **Electron main ↔ renderer:** typed IPC via tRPC-electron or hand-rolled types in preload. `window.api.*` calls.
2. **Electron main ↔ Swift sidecar:** newline-delimited JSON over stdin/stdout. Schema example:
   ```json
   {"type":"transcription","speaker":"OTHERS","text":"...","timestamp":1735000000,"isFinal":true}
   {"type":"audio_levels","you":0.4,"others":0.7}
   {"type":"error","code":"PERMISSION_DENIED","message":"..."}
   ```

## Status

### ✅ Completed (validation phase)

- **Step 0 — Stealth assumption validated.** Created `~/Documents/Projects/stealth-test/`
  with a 4-file Electron mini-app that calls `setContentProtection(true)`. Tested
  in **Google Meet** with full-screen share — the floating window is invisible to
  the share. Toggle (`⌘⇧P`) confirmed contrast (visible when off, invisible when on).
  **Architecture is viable.** TODO: re-test in Zoom and Microsoft Teams when those
  become relevant call apps for me.

### 🔜 Next — Step 2: Bootstrap the real project

Goal: a clean `~/Documents/Projects/perssua/` folder that boots, has hot reload,
shows the stealth window with a React UI inside it, has Tailwind working, and
is the foundation for everything from here.

**What to build (Claude Code: do this next):**

Create the following files in this folder (`~/Documents/Projects/perssua/`):

#### `package.json`
- name: `perssua`
- scripts: `dev` (electron-vite dev), `build` (electron-vite build), `preview`, `typecheck` (tsc --noEmit)
- devDeps: electron@^33, electron-vite@^2, vite@^5, @vitejs/plugin-react, react, react-dom, typescript, @types/{node,react,react-dom}, tailwindcss, autoprefixer, postcss
- **Do NOT** set `"type": "module"` — keep CommonJS for main/preload to avoid friction with native modules and the Swift sidecar IPC later.

#### `tsconfig.json`
Single tsconfig (simpler than electron-vite's split convention for now). Target ES2022, module ESNext, moduleResolution bundler, strict, noEmit, jsx react-jsx, lib `["ES2022","DOM","DOM.Iterable"]`, types `["node","vite/client"]`, path alias `@renderer/*` → `src/renderer/src/*`.

#### `electron.vite.config.ts`
```ts
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    plugins: [react()]
  }
});
```

#### `tailwind.config.js` (CJS — `module.exports`)
content: `['./src/renderer/**/*.{html,js,ts,jsx,tsx}']`

#### `postcss.config.js` (CJS)
plugins: `tailwindcss`, `autoprefixer`

#### `src/main/index.ts`
- App lifecycle (whenReady, window-all-closed, will-quit unregister hotkeys)
- Calls `createStealthWindow()` from `./window/StealthWindow`
- Registers global hotkeys: `⌘⇧P` (toggle protection, sends IPC `protection:state`), `⌘⇧H` (hide/show), `⌘⇧Q` (quit)

#### `src/main/window/StealthWindow.ts`
Factory function returning a `BrowserWindow` with:
- 480×320, frameless, transparent, hasShadow false, alwaysOnTop true, skipTaskbar true, resizable false
- `webPreferences`: preload at `../preload/index.js`, contextIsolation true, nodeIntegration false, sandbox false
- After creation: `setContentProtection(true)`, `setAlwaysOnTop(true, 'screen-saver')`, `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
- Loads `process.env.ELECTRON_RENDERER_URL` in dev, `loadFile('../renderer/index.html')` in prod
- `show: false`, then `win.on('ready-to-show', () => win.show())`

#### `src/preload/index.ts`
- Uses `contextBridge.exposeInMainWorld('api', api)` exposing `onProtectionState(callback)` that subscribes to `protection:state` IPC and returns an unsubscribe function

#### `src/preload/index.d.ts`
Global `Window.api` type augmentation.

#### `src/renderer/index.html`
Standard Vite HTML with `<div id="root">` and `<script type="module" src="/src/main.tsx">`.

#### `src/renderer/src/main.tsx`
Standard React 18 createRoot mounting `<App />` in StrictMode. Imports `./index.css`.

#### `src/renderer/src/App.tsx`
- useState `protectionOn` (default true)
- useEffect subscribes to `window.api.onProtectionState`
- Renders the same PROTECTED/EXPOSED card as the stealth-test, in Tailwind classes:
  - Container: `drag-region h-screen flex items-center justify-center rounded-2xl border border-white/10 bg-[rgba(18,18,28,0.94)] text-white select-none`
  - Status text: `text-[38px] font-bold text-emerald-400` (or `text-red-400` when off)

#### `src/renderer/src/index.css`
- `@tailwind base; @tailwind components; @tailwind utilities;`
- `html, body, #root { height: 100%; margin: 0; background: transparent; }`
- `.drag-region { -webkit-app-region: drag; }`
- `.no-drag { -webkit-app-region: no-drag; }`

#### `.gitignore`
node_modules, out, dist, .DS_Store, *.log, .vscode, .idea

#### Then run
```bash
cd ~/Documents/Projects/perssua
npm install
npm run dev
```

**Acceptance for Step 2:** stealth window opens with React UI inside showing
"PROTECTED", `⌘⇧P` toggles state with hot-reloaded UI, `⌘⇧H` hides/shows,
hot-reload works for both main and renderer changes.

## Sprint roadmap (after Step 2)

| Sprint | Weeks | Deliverable | Risk |
|---|---|---|---|
| ✅ 0 | 1 | Stealth validation | Killer assumption |
| 🔜 1 | 1 | Real project bootstrap (Step 2 above) | Low — known stack |
| 2 | 2 | Settings page + routing + electron-store + keytar + shadcn/ui | Low |
| 3 | **3 weeks** | **Swift audio sidecar** — ScreenCaptureKit + AVAudioEngine + JSON protocol over stdin/stdout, separates `YOU` vs `OTHERS` | **High** — this is the hardest sprint, only Swift work in the project |
| 4 | 2 | Apple Speech in sidecar, live transcript in React UI | Medium |
| 5 | 2 | Vercel AI SDK in main, BYO key (keytar), `⌘D` triggers streaming analysis on last N seconds of transcript | Low |
| 6 | 2 | Prompt profiles system (5–6 presets: Sales, Tech Interview, LeetCode, English Coach, Generic, CEO Pitch) | Low |
| 7 | 2 | Translation (Apple Translation framework) + Summary (LLM with action items) | Low |
| 8 | 2 | Dogfooding in real meetings + bug backlog + .dmg self-signed | Medium |

**Total: ~14–16 weeks.**

## Costs (current phase: personal use)

- Build: $0 (local builds)
- Storage: $0 (everything local — settings, sessions, models)
- Hosting: $0 (no cloud)
- Apple Developer ID: $0 (skip, self-sign for personal use)
- LLM: $0 if using Gemini API free tier (1500 req/day on Flash, no card) OR Ollama local
- Tools (Electron, Vite, React, Tailwind, AI SDK, Xcode): all free

⚠️ **Important reality check:** Anthropic and ChatGPT/OpenAI subscriptions do
**not** include API access. To use Claude or GPT in this app I need separate API
keys (cost ~$5–25/month for personal usage). Default to Gemini free tier or
Ollama to stay at $0.

## Risks

1. **Swift sidecar (sprint 3)** — only platform-specific work in the project, biggest unknown. Mitigation: keep scope tight (audio capture + STT + JSON), debug as standalone CLI in Xcode, lean on AI assistant heavily.
2. **Diarization quality** — Apple Speech can confuse `YOU` vs `OTHERS` when speakers overlap or when audio leaks from speakers into mic (no headphones). Mitigation: hard-require headphones in onboarding.
3. **macOS permissions UX** — Screen Recording permission is needed for ScreenCaptureKit. Onboarding flow must guide carefully.
4. **Stealth in Microsoft Teams corporate builds** — Teams sometimes uses alternative capture paths. Validated on Meet only so far. Re-test on Teams when relevant.

## Conventions

- Logs from main: `console.log('[area] message')` — `[stealth]`, `[audio]`, `[llm]`, `[ipc]`, etc.
- IPC channel naming: `domain:event` — `protection:state`, `transcription:append`, `analysis:chunk`, `profile:select`.
- All API keys go through keytar, never electron-store, never plaintext on disk, never crossing into renderer.
- Sidecar JSON messages always have a `type` field as discriminator.

## Files already in this workspace

- `~/Documents/Projects/stealth-test/` — the Step 0 validation app. Keep as reference for one week, then delete.
- `~/Documents/Projects/perssua/CLAUDE.md` — this file.

---

**Next action for Claude Code:** read this file, then create the files described
in the "Next — Step 2" section above, run `npm install`, run `npm run dev`, and
confirm the stealth window with React UI inside opens and the `⌘⇧P` hotkey
toggles the visible state.
