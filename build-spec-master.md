# Master Build Specification — RepoRun Desktop App

**Audience: this document is written as direct instructions for an AI coding agent (Claude Code, OpenHands, or similar) performing the build.** It is a build spec, not a product spec — the companion `mvp-spec-v4-final.md` covers product decisions, pricing, and UX rationale; this document covers exactly how to construct the software. Where this doc and the product spec appear to conflict, this doc governs implementation detail, the product spec governs intent.

**Non-negotiable build principles the agent must follow throughout:**
1. Build in the dependency order given in Section 3. Do not skip ahead to a later phase before the phase it depends on is tested and working.
2. Every phase has a "Definition of done" and a "Test before proceeding" block. Do not mark a phase complete without passing its tests.
3. Where working, tested reference code is provided below, use it as-is or as the direct basis for the implementation — it has already been built and verified against real repos during prototyping. Do not redesign a working approach without a stated reason.
4. Where a real, unresolved technical blocker is documented (Section 6.4), do not silently re-attempt the same failed approach — implement the documented working fallback and flag the blocker as a tracked future item.
5. Never claim a security or privacy property in code comments, UI copy, or logs that isn't actually true of the current implementation (see Section 18, Language Discipline).

---

## 1. Full Tech Stack (Definitive)

| Layer | Choice | Why |
|---|---|---|
| Desktop framework | **Tauri 2.x** (Rust backend + OS-native webview) | Small installers (no bundled Chromium), fast startup, Rust backend suits security-sensitive system work |
| Backend language | **Rust** | Required by Tauri; memory safety matters for sandboxing/process-execution code |
| Frontend framework | **React 18+ with TypeScript** | Tauri's best-documented frontend target; typed data flow matters for classification results and generated form schemas |
| Styling | **Tailwind CSS** | Utility classes for consistent design-token reuse (Section 19) across a growing number of screens |
| Global app state | **Zustand** | Minimal boilerplate, handles frequent updates (live output log) without unnecessary re-renders |
| Server/external state | **TanStack Query** | Built-in caching (solves GitHub rate-limit requirement, Section 4), request de-duplication, cancellation |
| Container runtime | **Podman** (bundled fallback), detect-existing-Docker-first | Avoids Docker Desktop's company-size licensing exposure; no background daemon by default |
| Auth | **Supabase Auth** (free tier) | Mandatory signup, server-side trial tracking |
| Payments/licensing | **Lemon Squeezy or Gumroad** (merchant of record) | Handles card capture, tax/VAT compliance, license key generation/validation, cancellation — no custom billing code |
| Crash/error logging | **Sentry** (self-hosted-compatible or hosted free tier) with Rust + JS SDKs | Cross-stack crash reporting, opt-in, privacy-scoped (Section 16) |
| CI/CD | **GitHub Actions** | Free for public repos, matrix builds for Windows + macOS |
| Distribution | **GitHub Releases** | Free, unlimited bandwidth, integrates with Tauri's updater plugin |
| Auto-update | **tauri-plugin-updater** | Official Tauri updater, signs and verifies update artifacts, points at GitHub Releases |
| Malware/secret pre-scan | **Open-source scanner** (e.g. a maintained secret-pattern scanner + a maintained static malware-signature scanner) — evaluate current best-maintained free options at implementation time rather than hardcoding a specific tool name here, since this ecosystem changes; document the chosen tool's name and version in `/docs/security-tooling.md` once selected | Zero-cost pre-flight risk reduction |

---

## 2. Project Structure

```
reporun/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/               # Sidebar, TopBar
│   │   ├── home/                 # Search/drop input, Recent list
│   │   ├── explore/               # Category grid, ranked list, repo card
│   │   ├── projects/             # Saved projects list, delete confirm modal
│   │   ├── generated-interface/  # Tier1 form, Tier2 live view, Tier3 GPU status, agent Start/Stop
│   │   ├── messages/             # Unsupported-type, hardware-ceiling, low-signal-warning, network-disclosure, trial-expired
│   │   ├── auth/                 # Signup, login, account/settings
│   │   └── shared/                # Buttons, inputs, progress bars — design-token-driven
│   ├── stores/                   # Zustand stores (Section 20)
│   ├── queries/                  # TanStack Query hooks (GitHub API, Supabase)
│   ├── lib/                      # classifyRepo.ts, formatters, constants
│   ├── types/                    # Shared TS types (Classification, CliArg, AgentSignals, etc.)
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── commands/             # One module per command group: zip.rs, classify.rs, exec.rs, docker.rs, sandbox.rs, agent.rs, security.rs, diagnostics.rs
│   │   ├── lib.rs                # Command registration only — logic lives in commands/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .github/workflows/            # CI/CD pipelines (Section 17)
├── docs/                         # supported-types.md, security-tooling.md, privacy-policy.md, terms.md
└── tests/                        # e2e test suites (Section 24)
```

**Rule for the agent:** do not put business logic directly in `lib.rs`. `lib.rs` only registers commands. Each command's actual implementation lives in its own file under `commands/`, matching the module names above. This keeps each subsystem independently testable.

---

## 3. Core Engine — Build Order With Reference Implementation

This is the exact order used during prototyping, and it is proven to work end-to-end. Each phase below states what to build, provides working reference code where available, and states the test gate before moving to the next phase.

### Phase 3.1 — Scaffold
`npm create tauri-app@latest` — TypeScript/JavaScript frontend, npm package manager, React template, TypeScript flavor.
**Test before proceeding:** `npm install && npm run tauri dev` opens a window showing the default template with no errors.

### Phase 3.2 — Drag-and-drop (Tauri native events, not browser events)
**Critical implementation detail:** standard browser `onDragOver`/`onDrop` events do **not** fire for real file drops in Tauri — Tauri intercepts file drag events at the webview level before the page's JS sees them. Use Tauri's own `onDragDropEvent` via `getCurrentWebviewWindow()` instead.

```tsx
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const webview = getCurrentWebviewWindow();
const unlisten = webview.onDragDropEvent((event) => {
  if (event.payload.type === "over") { /* highlight drop zone */ }
  else if (event.payload.type === "drop") {
    const path = event.payload.paths[0]; // returns real filesystem paths
  } else { /* cancelled/left */ }
});
```

**Test before proceeding:** dragging any file over the app window visibly highlights the drop zone; dropping logs the real file path to console.

### Phase 3.3 — Zip reading (Rust)
Add `zip = "2"` to `Cargo.toml`. Implement `list_zip_contents(path: &str) -> Result<Vec<String>, String>` that opens the archive and returns every entry name. Register in `invoke_handler`.
**Test before proceeding:** drop a real `.zip`, confirm the full file list renders in the UI.

### Phase 3.4 — Extraction (Rust)
Implement `extract_zip(path: &str) -> Result<String, String>`: create a uniquely-named folder under `std::env::temp_dir()` (name it using current-time-millis to guarantee uniqueness across concurrent/repeated extractions), walk every zip entry, create directories, copy file contents out, return the extraction folder path.
**Test before proceeding:** extracted files exist on disk at the returned path and match the zip's contents exactly.

### Phase 3.5 — Classification (TypeScript, rule-based)
```ts
function classifyRepo(fileNames: string[]): Classification {
  const lower = fileNames.map(n => n.toLowerCase());
  const has = (t: string) => lower.some(n => n.endsWith(t));
  if (has("docker-compose.yml") || has("docker-compose.yaml")) return { tier: "Tier 4", reason: "..." };
  if (has("dockerfile")) return { tier: "Tier 2", reason: "..." };
  if (has("requirements.txt") || has("package.json")) return { tier: "Tier 1", reason: "..." };
  return { tier: "Unsupported", reason: "..." };
}
```
Also implement the confidence score alongside this: a repo matching exactly one clear signal = high confidence; a repo matching conflicting signals (e.g. both Dockerfile and no clear entrypoint) or only a weak/ambiguous signal = low confidence, routes to the confirmation screen (Section 19) before any setup begins.
**Test before proceeding:** run against at least one real repo per tier (build test fixtures — see Section 24.1) and confirm correct tier + correct confidence flag on each.

### Phase 3.6 — CLI argument detection (Rust, regex)
Add `walkdir = "2"`, `regex = "1"`. Implement `find_cli_args(folder_path: &str) -> Result<Vec<String>, String>`: walk all `.py` files, regex-match `add_argument\(\s*["']([^"']+)["']` (extend with equivalent patterns for `click`, `commander`, `yargs` before this phase is considered fully done for Tier 1 — see Section 3.9 for the Node.js extension this spec requires beyond the original prototype).
**Test before proceeding:** against a known-argument test fixture, the exact expected argument list is returned, no duplicates, no false positives from unrelated code.

### Phase 3.7 — Form generation (React)
Map each detected arg to a text input keyed by argument name in a `Record<string, string>` state object (`formValues`). Render inputs with the argument name as label.
**Test before proceeding:** typing into a field updates state correctly and is preserved across re-renders until Run is clicked.

### Phase 3.8 — Restricted execution (Rust) — current sandboxing baseline
**Full Windows AppContainer isolation was attempted and hit a real, unresolved low-level failure: `CreateProcessW: extended startup with AC/LPAC`, even under Administrator. Do not re-attempt raw AppContainer/LPAC integration as part of this initial build — implement restricted execution below as the working baseline, and track full AppContainer as a documented future hardening item (Section 6.4), not a build blocker.**

```rust
let mut cmd = std::process::Command::new("python");
cmd.arg(&entry_file);
cmd.current_dir(&folder_path);        // confines relative file access to the extracted repo
cmd.env_clear();                       // strip full environment
for var in ["PATH", "SYSTEMROOT", "APPDATA", "USERPROFILE"] {
    if let Ok(v) = std::env::var(var) { cmd.env(var, v); }
}
// APPDATA/USERPROFILE are required for Python's own package lookup to work — omitting
// them causes ModuleNotFoundError for any pip-installed dependency. This was discovered
// during testing; do not omit these two.
cmd.stdout(Stdio::piped());
cmd.stderr(Stdio::piped());
let mut child = cmd.spawn()?;
// wait-timeout = "0.2" crate — wait up to 30s, kill via SIGKILL-equivalent if exceeded
let status = child.wait_timeout(Duration::from_secs(30))?;
match status {
  Some(s) => { /* return captured stdout/stderr based on s.success() */ },
  None => { child.kill()?; return Err("Script timed out after 30 seconds".into()); }
}
```

**Additional required hardening not yet in the original prototype, required for this build:**
- Sanitize every form value before use: trim whitespace, strip leading/trailing single or double quotes (`^["']|["']$`). **This is a required rule, not optional** — discovered directly during testing (Windows' "Copy as path" wraps paths in literal quote characters, which breaks any script expecting a raw path).
- Apply this stripped-environment approach identically for macOS (adjust the retained variable list to macOS equivalents: `PATH`, `HOME`, and any variable a package manager on that OS requires for dependency lookup — verify empirically per Section 24 rather than assuming Windows' list transfers directly).

**Test before proceeding:** a script requiring a pip-installed dependency runs successfully; a script given a quoted pasted path runs successfully; a deliberately infinite-looping script is killed at the 30-second mark and returns a clear timeout error, not a hang.

### Phase 3.9 — Extend argument detection to Node.js (required for this build, not optional)
The original prototype only detected Python's `argparse` pattern. Before Tier 1 is considered complete, add detection for `commander` (`.option\(\s*["']([^"']+)["']`) and `yargs` (`.option\(\s*["']([^"']+)["']` / builder-pattern equivalents) against `.js`/`.ts`/`.mjs` files, and extend `run_cli_tool` to launch via `node` when the detected entry file is JS/TS rather than Python.
**Test before proceeding:** a real Node CLI tool using each of `commander` and `yargs` is correctly form-generated and runs successfully end-to-end.

### Phase 3.10 — Tier 2 execution (Docker/Podman)
```rust
// docker build -t <unique-tag> <folder_path>, then docker run -d -p <host>:<container> <tag>
```
**Required change from the original prototype before this is considered done:** the prototype hardcoded port 5000→5050. This build must instead: (a) detect the port a Dockerfile actually `EXPOSE`s via a regex scan of the Dockerfile contents, and (b) dynamically pick an available host port at runtime (bind to port 0 or scan a port range) rather than a fixed host port — a fixed host port causes a collision on any second concurrent Tier 2 run. **This is a required correctness fix, not a stretch goal.**

**Test before proceeding:** two different Tier 2 repos can run simultaneously without port collision; the correct exposed port is auto-detected from an arbitrary Dockerfile, not assumed.

### Phase 3.11 — Container runtime detection
Before invoking `docker build`, check for an existing working Docker or Podman install (`docker --version` / `podman --version`, non-zero exit or "not recognized" = absent). If both absent, trigger the silent Podman-bundling flow (download, install, no user-facing runtime choice — Section 5). If Docker Desktop is detected and working, use it as-is; never attempt to silently install Docker Desktop under any circumstance (licensing risk at scale, per product spec Section 5.3).

---

## 4. GitHub API & ZIP Download

- **URL paste:** direct zip download via `https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}` — no auth required for public repos. Detect branch via the GitHub API's default-branch field first (don't hardcode `main`; many repos still default to `master`).
- **Search-by-name:** GitHub Search API (`/search/repositories`), debounce 400ms, 3-character minimum, cancel in-flight request on new keystroke (use `AbortController`), cache results in-session.
- **Explore:** GitHub Search API filtered by `topic:` qualifier + `sort=stars`, one query per category. **Do not scrape GitHub's trending page** — it isn't an official API, is fragile, and risks ToS issues.
- **Rate limits:** 10 req/min unauthenticated, 30 req/min if the user signs into GitHub (optional, offer non-intrusively). Implement via TanStack Query with `staleTime` set to 15-30 minutes for Explore category queries specifically — this is a hard requirement from the product spec, not a nice-to-have, since Explore browsing behavior (clicking through categories) can otherwise exhaust the rate limit quickly.
- **Smart single input:** detect `owner/repo` pattern or a full URL via regex before deciding whether to hit the search endpoint at all — most direct-paste usage should never touch the rate-limited path.
- **Graceful degradation:** if a rate limit is hit, fall back to "paste the link directly" messaging — never a raw error.

---

## 5. Docker and Compose

- Tier 2 = single Dockerfile, build + run as described in Phase 3.10.
- Tier 4 = `docker-compose.yml` present → use `docker compose up -d` (or Podman's compose-compatible equivalent) instead of the single build/run path. Detect all exposed ports across services the same dynamic way as Tier 2 (Section 3.10), not hardcoded.
- Podman bundling: silent background install triggered only on first Tier 2/4 use if no runtime is detected, with a single visible "Setting up container support (one-time, ~30 seconds)" progress state — never a blocking modal with no explanation.
- Pause/unpause: Tier 2/4 uses real `docker pause` / `docker unpause` (or Podman equivalent) when a session is superseded by a new Home drop while still running (Recent-list 24h behavior, product spec Section 6.3).

---

## 6. Local Terminal & File Access

### 6.1 File access scope
Every execution (Tier 1 script, Docker build context) is confined to the repo's own extracted temp folder. Never grant read/write access outside that folder as part of core execution. The one exception is explicitly user-directed input (e.g., a form field the user fills with a path to their own file elsewhere on disk, such as the image-resizer example) — that access is user-initiated and expected, not something the sandboxing model should block.

### 6.2 Cleanup policy (not in the original prototype — required for this build)
Extracted temp folders must not accumulate indefinitely. Implement a cleanup pass: on app startup, delete any `reporun-*` temp folders older than the Recent-list 24-hour window (product spec Section 6.3) that aren't associated with a saved Project. Saved-Project extraction folders persist until the user deletes that Project.

### 6.3 Disk space check (required addition)
Before extraction, check available disk space against the zip's uncompressed size estimate (available from the zip's central directory metadata). If insufficient, show a clear pre-flight message rather than a failed/partial extraction — same "check before spending resources" principle as the unsupported-type and hardware-ceiling checks.

### 6.4 Documented, unresolved blocker (do not silently re-attempt)
**Windows AppContainer/LPAC integration** (attempted via the `rappct` crate during prototyping) fails at `CreateProcessW` with `extended startup with AC/LPAC`, reproducible even under Administrator privileges. This is tracked as a post-launch hardening item, not a build blocker for this spec. If a future build attempt revisits this, start from the crate's own official working example/demo rather than a hand-rolled minimal reproduction, and budget dedicated debugging time separate from the main build timeline.

**Windows WSL2 "reports Enabled but binary missing"** — `Get-WindowsOptionalFeature` can report `Enabled` for `Microsoft-Windows-Subsystem-Linux` while `wsl.exe` genuinely does not exist on disk. The reliable fix during prototyping was `wsl --install --no-distribution` after confirming `Test-Path C:\Windows\System32\wsl.exe` returns `False` despite the feature reporting Enabled — document this exact diagnostic sequence in end-user troubleshooting docs and the AI support agent's knowledge base (Section 16), since this is a real, non-obvious, reproducible failure mode, not a one-off fluke.

---

## 7. Dependency & Runtime Detection

Before attempting execution, detect and report (not silently assume) the presence and version of: Python (`python --version`), Node (`node --version`), Docker/Podman (Section 3.11). Surface missing-runtime states as a pre-flight message consistent with the rest of the app's "never a silent wait, never a dead end" principle — e.g., a Tier 1 Python repo dropped on a machine with no Python installed should say so clearly with a next action, not fail opaquely mid-execution.

**Required addition beyond the original prototype:** dependency installation (`pip install -r requirements.txt` / `npm install`) is currently *not automated* — the working prototype assumes dependencies are pre-installed. This build must add an install step before first execution of a given repo, with:
- A registry cache/proxy layer for common packages to keep repeated installs fast (product spec's install-time cost-mitigation strategy)
- A separate, explicit timeout for the install step distinct from the execution timeout (don't let a slow install eat into the 30-second execution budget)
- Clear stage messaging: "Installing dependencies..." as its own visible stage in the download/setup progress UI (Section 19)

---

## 8. AI Provider Abstraction (LLM Classification Fallback)

The optional LLM-assisted classification fallback (used only for genuinely ambiguous repos, off by default, bring-your-own-API-key) must be built behind a provider-agnostic interface, not hardcoded to one vendor:

```ts
interface ClassificationLLMProvider {
  name: string;
  classify(repoTree: string[], readme: string | null, apiKey: string): Promise<Classification>;
}
```
Implement at minimum two concrete providers (e.g. OpenAI-compatible and Anthropic-compatible) behind this interface, selected by the user in Settings alongside where they paste their own key. Store the key using the same OS-native credential store approach as agent-repo secrets (product spec Section 4.4.3) — never in plain local storage or a plain config file. This keeps the door open for adding providers later without touching classification call sites.

---

## 9. Auth (Supabase)

- Supabase Auth, free tier (50K MAU).
- Signup flow: email + password (or magic link), **card capture via the payment gateway checkout before trial start** (product spec Section 3 — this is a confirmed decision, not optional), plain-language fingerprinting disclosure shown inline during signup (not buried in a linked policy).
- Trial start/end dates stored server-side in Supabase, associated with the account — not locally, to close the reinstall-abuse loophole.
- Device fingerprint (a simple hardware-derived identifier, not invasive tracking) stored alongside the account at signup; flag — don't silently block — new signups from an already-used device, and route to a clear "it looks like you've already used a trial" message with a path to subscribe directly.
- Disposable-email blocklist checked at signup using a maintained free open-source list.
- Keep-alive: scheduled GitHub Actions job pinging the Supabase project every few days to prevent free-tier pause after 7 days of inactivity.

---

## 10. Licensing & Billing / Payment Gateway

- Lemon Squeezy or Gumroad as merchant of record — do not build custom card handling; use their hosted checkout.
- Single plan: $7/month or $77/year, full access to all four tiers, no usage metering.
- License key delivery: automatic on successful payment via the gateway's built-in key generation.
- Validation: on first activation, one call to the gateway's license-verification API; store the confirmation locally, **signed/encrypted** (Section 12), re-check roughly every 30 days in the background — not on every app launch.
- **Cancellation must be genuinely one-click, self-serve, in-app** — this is a hard requirement tied directly to the "no strings attached" messaging shown at signup (product spec Section 3, Section 12.2). Do not ship a cancellation flow that requires contacting support or leaving the app.
- **Compliance check required before public launch, not optional:** confirm card-required-trial and auto-renewal disclosure requirements against applicable regulations (US FTC click-to-cancel rule, EU consumer law, India RBI e-mandate rules if targeting that market) — verify what the chosen payment gateway already handles versus what needs custom disclosure UI. Do not treat this as resolved by default; it is explicitly flagged as an open item in the product spec and must be closed before launch.

---

## 11. Offline Grace Period

Not previously specified in detail — required for this build:
- If the periodic (≈30-day) license re-validation check fails because the device is offline (not because the license is actually invalid), grant a **14-day grace period** of continued full access before restricting functionality.
- During the grace period, show a small, non-blocking status indicator (not a modal) noting the app hasn't been able to verify the license recently and will need connectivity within N days.
- If the grace period expires without a successful check, fall back to the same trial/subscription-expired UI state already defined (product spec Section 6.3 #13) rather than a distinct new error state — browsing/search remain unblocked, only execution is gated, consistent with the existing expired-trial behavior.
- Explicitly distinguish this from an actually-cancelled or actually-expired subscription (a definitive "no" from the gateway) — grace period only applies to inability-to-check, never to a confirmed negative license status.

---

## 12. Secure Token Handling

- License/session tokens: stored using the OS-native credential store (Windows Credential Manager, macOS Keychain) — same mechanism specified for agent-repo secrets (product spec Section 4.4.3). Do not store tokens in a plain local file or in browser-equivalent local storage.
- Supabase session tokens: use Supabase's own SDK-provided secure session handling; do not hand-roll token storage separately from what the SDK already provides.
- API keys the user provides for the optional LLM classification fallback (Section 8): same OS-native credential store, never logged, never included in crash reports (Section 16) or diagnostic exports (Section 22.3).
- No token or secret value is ever transmitted anywhere except to the specific service it authenticates against (Supabase session token → Supabase only, payment gateway license key → gateway's own validation endpoint only, LLM API key → the selected provider's API only).

---

## 13. Code Signing Installers

**Deferred at launch per product spec (Section 8.4), but the agent must still build the app so this can be added later without rework:**
- Structure the CI/CD release pipeline (Section 17) with a clearly separated signing step that is currently a no-op, rather than baking "unsigned" assumptions into the build scripts in a way that requires rework later.
- Windows: when added, this will be Authenticode signing via a purchased code-signing certificate, integrated into the Tauri build via `tauri.conf.json`'s signing config.
- macOS: when added, this will require both a Developer ID Application certificate (Apple Developer Program, $99/yr) and notarization via `xcrun notarytool` (or Tauri's built-in notarization support) — the two are separate steps and both are required for Gatekeeper to allow unprompted launches.
- Until signing is added: disclose the expected SmartScreen/Gatekeeper warnings clearly on the download page, and submit installers to Microsoft's free SmartScreen reputation program as an interim trust-building measure.

---

## 14. Auto-Updates

- `tauri-plugin-updater`, pointed at GitHub Releases.
- Update check: on app launch, one disclosed, opt-out-able background check — never forced, never silent about the fact that a check happens.
- Update artifacts must be signed (Tauri's updater requires this for integrity verification) even before installer code-signing (Section 13) is added — these are two separate signing mechanisms; do not conflate them or skip updater-artifact signing because installer signing is deferred.
- Rollback plan (required addition): before a new version is published to the "latest" release channel, keep the previous version's release artifacts available and documented as a manual rollback path, in case a bad update needs to be pulled quickly.

---

## 15. Versioning

- Semantic versioning (`MAJOR.MINOR.PATCH`) for all releases.
- Every release requires an accompanying changelog entry — enforce this in the CI/CD pipeline (Section 17) as a required file check before a release build is allowed to publish, not just a convention.
- Tag every release in git matching the published version exactly; the updater's version comparison depends on this being consistent.

---

## 16. Crash Logging & Diagnostics for Support

- Sentry (or equivalent) integrated on both the Rust side and the React side, so a crash in either layer is captured.
- **Opt-in, not default-on** — disclosed clearly, consistent with the app's overall minimal-telemetry posture (product spec's "fully offline" language correction, Section 7.2). Default off; a clear, specific opt-in during onboarding or Settings.
- **Scope of what's captured, required to be privacy-safe:** stack traces, app version, OS version, hardware class (not exact serial/identifiers) — never repo contents, never form field values (which may contain paths, secrets, or agent-repo API keys), never license/session tokens (Section 12).
- **Diagnostics bundle for support:** a user-triggered "Export diagnostics" action (Settings) that packages recent logs, app version, OS info, and the AI support agent's escalation context into a single file the user can attach to a GitHub Issue or support conversation — built from the same privacy-safe scope as crash logging above.
- This directly feeds the AI support agent's escalation flow (product spec Section 8.3): a filed GitHub Issue from an auto-escalation should include this diagnostics bundle by default when the user consents.

---

## 17. Basic CI/CD

GitHub Actions, minimum required pipeline:
1. **On every PR:** run frontend unit tests (Vitest), Rust unit tests (`cargo test`), lint (`cargo clippy`, `eslint`), and a build check on both Windows and macOS runners.
2. **On merge to main:** same as above, plus build unsigned installers as artifacts for manual QA.
3. **On version tag push:** full release pipeline — build signed (once Section 13 is active) or clearly-labeled-unsigned (until then) installers for Windows and macOS, publish to GitHub Releases, verify changelog entry exists (Section 15) before allowing publish.
4. **Scheduled job:** Supabase keep-alive ping (Section 9), running independently of the release pipeline.

---

## 18. Privacy Policy, Terms & License

Required documents (drafted, not just referenced) before public launch, all placed under `/docs`:
- **Terms & Conditions** — must include the Supported Repository Types clause and No Guarantee of Compatibility clause exactly as specified in the product spec (Section 7.1), the four-tier public commitment (product spec Section 2/12.4), and cancellation terms consistent with Section 10 above.
- **Privacy Policy** — must accurately describe: what Supabase stores (account email, trial dates, device fingerprint), what the payment gateway stores (handled by gateway, link to their policy), what crash logging captures if opted in (Section 16), and explicitly state what is never collected (repo contents, form values, secrets/tokens).
- **License** (for the app itself, and separately for the open-source parts of the codebase if any are published) — choose and document explicitly; do not leave this implicit.
- **Language discipline, enforced across all three documents and all in-app copy:**
  - Never "fully offline" — "runs locally — only touches the internet for sign-in, license checks, and updates."
  - Never "runs perfectly" — "runs reliably, with clear errors when something goes wrong."
  - Never "guarantees this repo is safe" — "we scan for known risk patterns before running anything."
  - Never claim full sandbox isolation while restricted execution (Section 3.8) is the actual implemented baseline — describe protection accurately to what's actually running.
- **Legal review required before publishing** — these are drafts; do not treat agent-drafted legal text as launch-ready without a lawyer or legal-template service pass, especially given the compliance open item in Section 10.

---

## 19. UI/UX — Full Screen Build List & Design Tokens

### 19.1 Design tokens (GitHub-Apple fusion, confirmed final direction)
- Borders: 0.5px hairline, not shadows, for all card/panel separation
- Accent: single restrained blue, used only for primary actions and active nav state
- Corner radii: 12-16px for cards/panels, tighter (~8px) for small inline elements — softer than GitHub's native 6-8px, sharper than a fully rounded consumer app
- Typography: monospace specifically for repo names, search input, and code-identifier text; standard sans-serif everywhere else
- Icons: live inside tinted rounded-square badges (not bare), color-mapped meaningfully per category in Explore, not one repeated accent color
- Spacing: generous padding throughout — Apple-influenced, not GitHub's denser default
- Personal greeting header on Home ("Good evening, [name]") rather than a plain dashboard title

### 19.2 Full screen list (build all of these; none are optional for MVP)
1. Signup — email/password, card capture, fingerprinting disclosure, trial-start confirmation
2. Home — persistent sidebar, smart search/paste field, drop zone, Recent Activity list, greeting header
3. Explore landing — search bar + 10-category tinted-icon grid
4. Explore category detail — breadcrumb, ranked list (rank #, name, creator, stars, single Run CTA), click-for-description
5. Projects — saved list, delete with confirmation modal
6. Download/setup progress — live stage indicator + real ETA, distinct "installing dependencies" stage (Section 7)
7. Low-confidence classification confirmation
8. Agent-repo network access disclosure (product spec 4.4.2)
9. Low-signal repo warning (product spec 4.3)
10. Generated interface — Tier 1 form + output log + "report misclassification" action; Tier 2/4 live view + Open in Browser/Stop; Tier 3 adds GPU status; agent long-running repos get Start/Stop instead of Run
11. Unsupported repo type message
12. Hardware ceiling message
13. Trial/subscription expired
14. Offline-grace status indicator (Section 11 — new, not in original screen list)
15. Settings/account — subscription status, one-click cancel, sign out, diagnostics export (Section 16), LLM provider/API key config (Section 8), supported-types docs link
16. Support chat — AI agent, GitHub Issue auto-escalation with diagnostics bundle attach

**Every screen above must be reachable through the persistent left sidebar (Home/Explore/Projects) and pass the functional test checklist in Section 24.5 before the build is considered UI-complete.**

---

## 20. State Management Wiring

- **Zustand stores:** `sessionStore` (active drop/classification/execution state for the current Home session), `recentStore` (24h Recent list + pause state per item), `projectsStore` (saved Projects), `navStore` (active sidebar section).
- **TanStack Query hooks:** `useGithubSearch`, `useExploreCategory` (staleTime 15-30 min, per Section 4), `useRepoDescription`, `useSupabaseSession`, `useLicenseStatus`.
- **Local component state (`useState`):** only for genuinely transient, single-screen state — e.g. a form field's raw text before submission. Do not lift transient state into Zustand "for consistency" if nothing else needs it.

---

## 21. Agent Repo Handling (build requirement, condensed from product spec Section 4.4)

Implement as an additional detection pass layered onto classification (not a separate pipeline):
- Agent-framework/API signal (known SDK imports, known API hostnames)
- Secrets signal (`.env.example`/`.env.template`, `*_API_KEY`/`*_TOKEN`/`*_SECRET` env-var read patterns)
- Long-running signal (server start calls, event loops, chat-loop patterns)

Network egress stays default-deny; agent repos get a scoped, disclosed, one-click-approved allowlist via OS-native firewall APIs (Windows Firewall, macOS pf) — never a blanket exception. Secrets become form fields (same screen as CLI args), written to a local repo-scoped config file, optionally cached in the OS credential store (Section 12). Long-running repos get Start/Stop instead of Run, with a 24-hour idle SIGKILL ceiling instead of the 30-second one-shot timeout.

---

## 22. Security Layering (build requirement, condensed from product spec Sections 4.3/5.4/12.3)

1. **Pre-flight malware/secret-pattern scan** — before any setup begins, alongside classification. Build a test corpus of known-bad patterns (Section 24.4) to validate this actually catches what it should before shipping.
2. **Low-signal repo warning** — combine star count, repo age, and contributor count (all from the same GitHub API call already in use) rather than gating on stars alone.
3. **Runtime monitoring** — OS-native process monitoring watching for suspicious behavior during execution, as a fallback layer if sandboxed execution is somehow escaped. This is defense-in-depth on top of, not a replacement for, the pre-flight scan and restricted execution (Section 3.8).
4. **Diagnostics export** (Section 16) doubles as an incident-review tool if a security concern is ever reported.

---

## 23. Additional Improvements Not in the Original Request List

These weren't explicitly asked for but are necessary for a genuinely market-ready build; include all of them:

- **Accessibility:** every interactive element keyboard-navigable, proper ARIA labels on icon-only buttons, sufficient color contrast on all status badges (verify the tinted-badge system in Section 19.1 against WCAG AA, not just visually "looks fine").
- **Error boundaries:** a React error boundary around the generated-interface rendering specifically — a malformed or unusual repo's classification/form-generation should never crash the whole app, only show a contained error state with a "report misclassification" path.
- **Structured logging:** consistent log format across Rust and React (structured JSON, not ad-hoc string logs) so diagnostics exports (Section 16) and future debugging are actually usable.
- **Config schema versioning:** the local repo-scoped config files (agent secrets, Section 21) should include a schema version field from day one, so future format changes don't silently break existing users' saved configs.
- **Backoff on GitHub API failures:** exponential backoff with a capped retry count on transient GitHub API failures (not just rate limits) before surfacing an error to the user.
- **First-run system check, surfaced honestly:** on first launch, a quick hardware/runtime capability check (per product spec Section 4.3's hardware-ceiling logic) shown to the user as "here's what your machine can run" rather than only surfacing limits reactively per-repo.

---

## 24. Testing Strategy — Per Stage of Development

### 24.1 Unit testing
- **Rust:** `cargo test` for every command in `commands/` — zip reading/extraction (valid zip, corrupted zip, empty zip, zip with path traversal attempts — explicitly test that `../` entries in a zip cannot escape the extraction folder), classification-adjacent Rust logic, restricted-execution environment construction, Docker command construction (mock the actual `docker` binary call in unit tests, don't require Docker installed to run unit tests).
- **Frontend:** Vitest + React Testing Library for `classifyRepo`, form-value sanitization (quote-stripping, Section 3.8), Zustand store logic, TanStack Query hook behavior with mocked responses.

### 24.2 Integration testing
- Full Tauri command round-trip tests: invoke each command from a test harness exactly as the frontend would, against real (small, checked-into-`tests/fixtures/`) zip files — one fixture per tier plus one deliberately unsupported fixture plus one deliberately malformed/corrupted fixture.
- GitHub API integration tests against real endpoints in CI, with clear skip/mock behavior if rate-limited during a CI run (don't let CI flakiness from GitHub's own rate limits block unrelated PRs).

### 24.3 End-to-end testing
- Use `tauri-driver` (WebDriver-based, Tauri's official e2e testing approach) to drive the actual compiled app: drop a real fixture zip, confirm classification, confirm form renders, confirm Run produces expected output, confirm a Tier 2 fixture actually builds and becomes reachable at its reported localhost address.
- Run the e2e suite on both Windows and macOS runners in CI (Section 17) — a passing test on one OS is not sufficient given the platform-specific sandboxing/runtime-detection code paths.

### 24.4 Security testing
- `cargo audit` and `npm audit` in CI on every PR, failing the build on any high/critical advisory.
- Build a dedicated test corpus of known-malicious-pattern samples (safe, inert test fixtures, never real malware) to validate the pre-flight scanner (Section 22.1) actually flags what it's supposed to, and does not false-positive on the legitimate tier-fixture repos from Section 24.2.
- Explicitly test the zip-extraction path-traversal case (Section 24.1) as a security test, not just a unit test — this is a known real-world vulnerability class for any zip-extraction feature.
- Explicitly test that the restricted-execution environment (Section 3.8) actually cannot read files outside the extraction folder — write a test fixture script that attempts to read a known file elsewhere on the test machine and confirm it fails.

### 24.5 UI/UX functional testing (every screen, every interaction — required, not optional)
For every screen listed in Section 19.2, explicitly verify:
- Every button/action performs the correct state transition and no other
- Every loading/progress state actually clears correctly on both success and failure paths (a stuck spinner on an error path is a common, easy-to-miss bug class)
- Every message-pattern screen (unsupported-type, hardware-ceiling, low-signal-warning, network-disclosure, trial-expired, offline-grace) is reachable via its actual trigger condition in a real test scenario, not just visually reviewed as a static mockup
- Sidebar navigation is persistent and correctly highlights the active section from every reachable screen
- Recent-list 24h expiry and pause/resume behavior (Tier 1 save-and-stop vs. Tier 2 real pause) both function correctly under an accelerated test clock, not just reasoned about
- Delete-Project confirmation modal actually blocks deletion until confirmed, and actually deletes (including the underlying saved extraction/config data) once confirmed

### 24.6 Performance testing
- Cold-start time (installer double-click to interactive Home screen) — set a target, measure it, don't ship a regression silently.
- Memory footprint at idle and during an active Tier 2 container run.
- Extraction speed against a large (multi-hundred-MB) fixture repo, to catch pathological slowness before real users hit it.

### 24.7 Manual test matrix (required before any public release)
Test on, at minimum: Windows 10, Windows 11 (multiple recent builds, since the WSL "enabled but missing" issue in Section 6.4 was version-specific in nature), and at least two recent macOS versions across both Intel and Apple Silicon. Test with Docker present, Podman present, and neither present (triggering silent bundling) as three distinct scenarios.

### 24.8 Regression checklist before every release
Re-run the full Section 24.1–24.5 suite, not a subset, before every tagged release — do not rely on "nothing touched that code" reasoning to skip test coverage on a release build.

### 24.9 Pre-production final gate
Before the first public release is published:
- Full manual test matrix (24.7) passes with zero unresolved high-severity issues
- Security testing (24.4) passes clean
- Legal documents (Section 18) have completed a real legal review, not just an agent draft
- Compliance open item (Section 10) is explicitly closed, not deferred silently
- Diagnostics/crash logging (Section 16) verified to not leak any of the excluded data categories, spot-checked against real captured crash reports in a staging environment

### 24.10 Post-production verification (required after the first public release ships)
Do not treat shipping as the finish line. Immediately after production release:
- Re-run the full manual test matrix (24.7) against the actual signed/published production installers, not just CI build artifacts — a signing or packaging step issue can introduce problems that don't show up in unsigned CI builds.
- Monitor crash reports (Section 16) and AI support agent escalations (product spec Section 8.3) daily for the first two weeks specifically, treating any spike as a release-quality signal requiring immediate triage, not routine volume.
- Verify the auto-updater (Section 14) actually successfully updates a real installed copy of the previous version to the new one, end-to-end, as a distinct test from "the new version installs cleanly fresh" — update-path bugs are a different failure class from fresh-install bugs and are frequently missed.

---

## 25. Production Readiness Checklist (final gate — every item must be checked, not sampled)

- [ ] All four tiers execute correctly against real, diverse test repos (not just the fixture set)
- [ ] Agent repo handling (Section 21) verified against at least one real LangChain/CrewAI-style repo
- [ ] Restricted execution (Section 3.8) confirmed to actually confine file access and environment on both Windows and macOS
- [ ] Container runtime detection/bundling (Section 3.11, Section 5) verified in all three presence scenarios (24.7)
- [ ] Every screen in Section 19.2 passes its functional test (24.5)
- [ ] Auth, billing, license validation, offline grace, and cancellation (Sections 9-11) verified end-to-end against the real payment gateway in test/sandbox mode
- [ ] Compliance check (Section 10) explicitly closed
- [ ] Legal documents (Section 18) legally reviewed
- [ ] Security testing (24.4) clean
- [ ] Crash logging verified privacy-safe (24.9)
- [ ] CI/CD pipeline (Section 17) has successfully produced a real signed-or-clearly-labeled release artifact
- [ ] Manual test matrix (24.7) complete with zero unresolved high-severity issues
- [ ] Post-production verification plan (24.10) is staffed and ready to execute immediately after launch, not improvised after the fact
