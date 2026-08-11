# Supported Repository Types

RepoRun classifies a repository into exactly one of four tiers (or marks it
Unsupported). Classification is rule-based, run locally, and verified against a
test fixture set per tier before each release (see `tests/`).

## Tiers

| Tier | Detected by | How RepoRun runs it |
|---|---|---|
| **Tier 1 — Script / CLI** | `requirements.txt` (Python) or `package.json` (Node) | Detects CLI arguments (argparse / click / commander / yargs), generates a form, runs the entry file with a restricted environment and a 30-second one-shot timeout (24h idle ceiling for long-running agent repos). |
| **Tier 2 — Containerized app** | A single `Dockerfile` | `docker build` → `docker run -d -p <dynamic-host-port>:<EXPOSE-port>`. Host port is allocated dynamically (port 0) to avoid collisions across concurrent runs. The `EXPOSE` line is detected via regex scan, never hardcoded. |
| **Tier 3 — GPU workload** | A `Dockerfile` referencing CUDA / `nvidia` runtime / `torch` / `tensorflow` | Same as Tier 2, but the first-run hardware check surfaces whether the machine has GPU signal before attempting. |
| **Tier 4 — Multi-service (compose)** | `docker-compose.yml` / `compose.yml` | `docker compose up -d` (or Podman equivalent). All exposed ports detected dynamically. |
| **Unsupported** | None of the above signals | A clear message with a path forward — never a silent wait or dead end. |

## Agent repos

An additional detection pass (Section 21) layers onto classification, not a
separate pipeline. Signals:

- Agent-framework SDK imports (`langchain`, `crewai`, `autogen`, `llama_index`, `@langchain/core`).
- Known LLM API hostnames (`api.openai.com`, `api.anthropic.com`).
- Secrets: `.env.example` / `.env.template` presence, or `*_API_KEY` / `*_TOKEN` / `*_SECRET` env-var read patterns. These become form fields written to a repo-scoped config file.
- Long-running signal: server-start calls, event loops, chat-loop patterns. Long-running repos get Start/Stop instead of Run, with a 24-hour idle ceiling instead of the 30-second one-shot timeout.

Network egress stays default-deny. Agent repos get a scoped, disclosed,
one-click-approved allowlist via OS-native firewall APIs — never a blanket exception.

## No Guarantee of Compatibility

RepoRun does not guarantee any specific repo will run successfully. It runs
reliably, with clear errors when something goes wrong. Pre-flight scanning
identifies known risk patterns; it does not guarantee a repo is safe.
