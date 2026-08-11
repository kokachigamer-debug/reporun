# Changelog

All notable changes to RepoRun are documented here. Every release tag requires a
matching entry (enforced by CI — see `.github/workflows/release.yml`).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-11

### Added
- Initial scaffold: Tauri 2 + React 18 + TypeScript + Tailwind + Zustand + TanStack Query.
- Core engine (Phases 3.1–3.11): native drag-drop, zip read/extract (path-traversal safe), rule-based classification with confidence, CLI arg detection (argparse/click/commander/yargs), restricted execution with env_clear + 30s timeout + form-value sanitization, Node + Python launchers, runtime + container detection, dynamic-port Docker build/run, compose up.
- Agent-repo handling (Section 21): framework/API signal detection, secrets → form fields, long-running Start/Stop with 24h ceiling, scoped network allowlist disclosure.
- Security layering (Section 22): pre-flight secret/malware scan, low-signal warning, restricted execution baseline, diagnostics export.
- Frontend: all 16 screens from Section 19.2 (Home, Explore + category detail, Projects, generated interface per tier, message screens, Settings, Signup, Support, offline-grace indicator).
- LLM provider abstraction (Section 8): OpenAI-compatible + Anthropic providers, bring-your-own-key, off by default.
- Docs: supported-types, security-tooling, privacy-policy (draft), terms (draft), license.
- CI: PR pipeline (vitest + cargo test + clippy + fmt + cargo audit + npm audit + build check) on Linux/macOS/Windows; release pipeline with changelog enforcement; Supabase keep-alive cron.
- Tests: Vitest suite for `classifyRepo`, sanitization, GitHub URL parsing; Rust path-traversal + zip + classify unit tests.

### Known limitations
- Installers are **unsigned** at launch (Section 13). Code signing is a tracked post-launch addition; the build pipeline is structured for it.
- Windows AppContainer/LPAC full sandbox isolation is an unresolved tracked future item (Section 6.4); restricted execution is the current baseline.
- Payment gateway (Lemon Squeezy / Gumroad), Supabase project, and code-signing certs require user-provided keys/certs before public launch.
- Compliance open item (card-required-trial + auto-renewal disclosure) is explicitly unresolved and must be closed before launch.
