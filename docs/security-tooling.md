# Security Tooling

> **Status:** choices to finalize at implementation time. The spec (Section 1)
> deliberately defers hardcoding a specific tool name, since this ecosystem
> changes. Document the chosen tool + version here once selected.

## Pre-flight scan (Section 22 #1)

RepoRun runs a built-in regex-based pre-flight scan (see
`src-tauri/src/commands/security.rs`) for:

- **Secret patterns:** AWS access keys, GitHub PATs, generic `*_API_KEY`
  assignments, private-key blocks, Slack tokens.
- **Malware / suspicious patterns:** reverse-shell one-liners, `curl|sh` /
  `wget|sh` pipe-to-shell, `eval(base64_decode(...))` obfuscation, known
  crypto-miner indicators (`xmrig`, `stratum+tcp://`).

This is a *signal* layer — it surfaces a warning and blocks auto-run, it does
not render a verdict. A test corpus of inert known-bad-pattern fixtures lives
under `tests/security/` (Section 24.4).

## Recommended external scanner integration (future)

Evaluate current best-maintained free options at implementation time:

- **Secret-pattern scanner:** [`gitleaks`](https://github.com/gitleaks/gitleaks)
  is a maintained, Apache-2.0 tool that covers the same classes as the built-in
  scan and more. Candidate for an optional pre-flight pass.
- **Static malware-signature scanner:** [`clamav`](https://www.clamav.net/) (GPL)
  signature database, driven via `clamscan` over the extracted folder. Candidate
  for an optional pre-flight pass on Tier 2/4 images.

Both should be **opt-in** (the built-in regex scan is the default), with their
version pinned and recorded here once integrated:

| Tool | Version | Scope | Default |
|---|---|---|---|
| built-in regex scan | repo `0.1.0` | secrets + malware patterns | on |
| gitleaks | _to pin_ | secrets | off (future) |
| clamav | _to pin_ | malware signatures | off (future) |

## Restricted execution (Section 3.8) — current baseline

RepoRun's runtime confinement is **restricted execution, not full sandbox
isolation**:

- Working directory is confined to the repo's extracted temp folder.
- The process environment is cleared; only `PATH`, `SYSTEMROOT`, `APPDATA`,
  `USERPROFILE` (Windows) or `PATH`, `HOME`, `LANG`, `LC_ALL` (macOS/Linux) are retained.
- A hard timeout kills the process (30s one-shot, 24h for long-running agent repos).
- Form values are sanitized (quotes/whitespace stripped) before use.

Full Windows AppContainer/LPAC isolation is a **tracked future hardening item**
(Section 6.4) — it hit an unresolved `CreateProcessW` failure during prototyping
and is not a build blocker. We never claim "fully sandboxed" in copy or logs
until that lands.

## CI security gates (Section 24.4)

- `cargo audit` and `npm audit` run on every PR, failing on high/critical advisories.
- Zip-extraction path-traversal is a dedicated security test
  (`src-tauri/tests/zip_traversal.rs`).
- The restricted-execution folder confinement is tested by a fixture that
  attempts to read a file outside the extraction folder and confirms it fails.
