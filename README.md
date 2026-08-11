# RepoRun

RepoRun classifies and runs GitHub repositories **locally**, reliably, with clear
errors when something goes wrong. It runs locally — it only touches the internet
for sign-in, license checks, and updates.

> Built from the Master Build Specification (`build-spec-master.md`). See
> `docs/` for supported types, security tooling, and draft privacy/terms/license.

## What it does

Drop a repo `.zip` (or paste a GitHub link). RepoRun:

1. **Extracts** it into a uniquely-named temp folder (path-traversal safe).
2. **Classifies** it into one of four tiers with a confidence score.
3. **Pre-flight scans** for known secret / malware patterns before running anything.
4. **Runs** it under restricted execution (Tier 1) or a dynamically-ported
   container (Tier 2/3/4).

| Tier | Example |
|---|---|
| Tier 1 | Python/Node CLI — generates a form from detected `argparse`/`click`/`commander`/`yargs` args |
| Tier 2 | Single `Dockerfile` app — `docker build`/`run -d` on a dynamic host port |
| Tier 3 | GPU Dockerfile — surfaces hardware ceiling before running |
| Tier 4 | `docker-compose.yml` — `compose up -d` |

## Tech stack

Tauri 2 (Rust backend + OS-native webview) · React 18 + TypeScript · Tailwind ·
Zustand · TanStack Query · Podman (bundled fallback) or Docker.

## Develop

```bash
cd reporun
npm install
npm run tauri:dev
```

Requires Rust (`rustup`) and the Tauri Linux system deps on Linux
(`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, … — see
`.github/workflows/ci.yml`).

## Test

```bash
# Frontend
npm run test

# Rust
cd src-tauri && cargo test --all
```

## Build installers

```bash
npm run tauri:build
```

> Installers are **unsigned** at launch. Wire code signing via the
> `TAURI_SIGNING_PRIVATE_KEY` env vars (see `.env.example`) and macOS notarization
> before public release. The build pipeline is structured so this needs no rework.

## Project layout

See Section 2 of `build-spec-master.md`. In short:

```
src/                 # React frontend (components, stores, queries, lib, types)
src-tauri/src/       # Rust — lib.rs registers commands only; logic in commands/
docs/                # supported-types, security-tooling, privacy-policy, terms, license
.github/workflows/   # CI (PR), release (signed/unsigned), Supabase keep-alive
tests/fixtures/      # per-tier + malformed test fixtures
```

## Status

This is a buildable, deployable scaffold implementing the full spec surface.
Before public launch, close the explicitly-open items in `docs/terms.md` and
`docs/security-tooling.md` (code signing, payment-gateway wiring, Supabase
project, compliance review).
