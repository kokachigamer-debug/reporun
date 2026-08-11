# Privacy Policy (DRAFT — requires legal review before launch)

> **Status:** draft. Per spec Section 18, agent-drafted legal text is not
> launch-ready. Have a lawyer or legal-template service pass over this before
> publishing, especially given the compliance open item in `terms.md`.

RepoRun is a desktop application that classifies and runs GitHub repositories
**locally** on your machine. This policy describes what data is collected and
where it goes.

## What runs locally

Repo contents, extracted files, form field values, CLI arguments, and program
output never leave your machine. Classification and pre-flight scanning happen
locally.

## What we store (server-side)

- **Supabase Auth** stores your account email, trial start/end dates, and a
  simple hardware-derived device fingerprint used only to *flag* (not silently
  block) trial reuse. We do not store repo contents or form values.
- **The payment gateway** (Lemon Squeezy or Gumroad, acting as merchant of
  record) handles card capture, tax/VAT, license-key generation, and
  cancellation. Card details never touch RepoRun. See the gateway's own privacy
  policy for what they store.

## What crash logging captures (opt-in, off by default)

If you opt in (Settings → Crash & diagnostics), crash reports may include:

- Stack traces.
- App version and OS version.
- Hardware class (CPU count, total RAM, GPU-presence signal) — not serial numbers or identifiers.

Crash reports **never** include repo contents, form field values, license/session
tokens, or LLM API keys.

## What we never collect

- Repository contents or extracted files.
- Form field values (which may contain paths, secrets, or agent-repo API keys).
- License/session tokens or LLM API keys.
- Any token is ever transmitted only to the specific service it authenticates
  against (Supabase session → Supabase; license key → gateway validation only;
  LLM key → the selected provider only).

## Tokens & secrets

License/session tokens are stored in the OS-native credential store (Windows
Credential Manager, macOS Keychain), never in a plain local file or browser
local storage. API keys you provide for the optional LLM classification fallback
use the same mechanism.

## Diagnostics export

A user-triggered "Export diagnostics" action packages recent logs, app version,
OS info, and hardware class into a file you can attach to a GitHub Issue. It is
built from the same privacy-safe scope as crash logging.

## Updates

RepoRun checks for updates on launch via a disclosed, opt-out-able background
check using `tauri-plugin-updater` pointed at GitHub Releases.

## Language we use

We do not describe RepoRun as "fully offline" — it runs locally and only
touches the internet for sign-in, license checks, and updates. We do not claim
"full sandbox isolation" while restricted execution is the implemented baseline.
