# RepoRun — repository memory

## What this is
RepoRun: a Tauri 2 desktop app (Rust backend + React/TS frontend) that
classifies and runs GitHub repos locally. Built from `/workspace/build-spec-master.md`.

## Layout
- App root: `/workspace/project/reporun/`
- Frontend: `src/` (components, stores, queries, lib, types)
- Rust: `src-tauri/src/` — `lib.rs` registers commands only; logic in `commands/*.rs`
- Docs: `docs/{supported-types,security-tooling,privacy-policy,terms,license}.md`
- CI: `.github/workflows/{ci,release,keepalive}.yml`

## Toolchain
- Rust via `source "$HOME/.cargo/env"` (1.97.1). clippy + rustfmt installed as components.
- Node 22, npm. Frontend deps installed in `node_modules/`.
- Linux system deps for Tauri: webkit2gtk-4.1, gtk-3, librsvg, etc. (sudo apt).

## Commands
- Frontend test: `cd reporun && npm run test` (vitest, 15 tests)
- Frontend build: `cd reporun && npm run build` (tsc -b + vite build)
- Frontend lint: `cd reporun && npm run lint` (eslint)
- Rust check: `cd reporun/src-tauri && cargo check --all-targets`
- Rust clippy: `cd reporun/src-tauri && cargo clippy --all-targets -- -D warnings`
- Rust fmt: `cd reporun/src-tauri && cargo fmt --all -- --check`
- Rust test: `cd reporun/src-tauri && cargo test --all` (9 tests incl. path-traversal security)
- Full release build: `cd reporun/src-tauri && cargo build --release`
- Dev app: `cd reporun && npm run tauri:dev`
- Build installers: `cd reporun && npm run tauri:build`

## Gotchas learned
- Tauri 2 capabilities: `core:webview:allow-on-drag-drop-event` is NOT a valid
  permission — use `core:webview:default`. Drag-drop is enabled via
  `dragDropEnabled: true` in `tauri.conf.json` (NOT `fileDropEnabled`).
- `tauri-plugin-updater` v2 has no `init()` — use `Builder::new().build()`.
- `zip` crate v2 needs `features = ["deflate"]` (default-features = false) and
  imports are `zip::ZipWriter`, `zip::write::SimpleFileOptions`, `zip::CompressionMethod`.
- In Rust raw strings `r"..."` you CANNOT escape `\"` — use a normal `"..."`
  string with `\\` escapes, or a char-class `['""]`.
- `tsconfig.node.json` with `composite: true` must NOT have `noEmit: true`
  (TS6310). It emits `vite.config.d.ts` — gitignore those + `*.tsbuildinfo`.
- Name-shadowing: a local `zip` module shadows the `zip` crate in integration
  tests — alias with `use reporun_lib::commands::zip as rr_zip;`.

## Known limitations (pre-launch)
- Installers unsigned (code signing is a tracked post-launch addition).
- Windows AppContainer full sandbox is unresolved future work; restricted
  execution is the current baseline.
- Payment gateway (Lemon Squeezy/Gumroad), Supabase project, and code-signing
  certs need user-provided keys before public launch.
- Compliance open item (card-required-trial + auto-renewal disclosure) must be
  closed before launch — see docs/terms.md.
