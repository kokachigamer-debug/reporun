// Constants: explore categories, supported types, app version, paths.

import type { Tier } from "@/types";

export const APP_VERSION = "0.1.0";
export const RECENT_TTL_MS = 24 * 60 * 60 * 1000; // 24h (product spec 6.3)
export const EXEC_TIMEOUT_SECS = 30; // Tier 1 one-shot ceiling (Section 3.8)
export const AGENT_IDLE_CEILING_MS = 24 * 60 * 60 * 1000; // 24h for long-running
export const LICENSE_RECHECK_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // ~30d
export const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000; // 14d (Section 11)

export const GITHUB_API = "https://api.github.com";
export const CODELOAD_BASE = "https://codeload.github.com";

export const TIER_LABELS: Record<Tier, string> = {
  "Tier 1": "Tier 1 · Script / CLI",
  "Tier 2": "Tier 2 · Containerized app",
  "Tier 3": "Tier 3 · GPU workload",
  "Tier 4": "Tier 4 · Multi-service (compose)",
  Unsupported: "Unsupported",
};

export const TIER_DESCRIPTIONS: Record<Tier, string> = {
  "Tier 1":
    "Runs a single Python or Node script with detected CLI arguments as a form.",
  "Tier 2":
    "Builds and runs a single Dockerfile, exposing its declared port on an available host port.",
  "Tier 3":
    "A Dockerfile-based workload that references CUDA/GPU runtime — requires compatible hardware.",
  "Tier 4":
    "Multi-service stack orchestrated with docker compose — all exposed ports detected dynamically.",
  Unsupported:
    "No recognized entrypoint or container file. Paste a different repo or run it manually.",
};

export interface ExploreCategory {
  key: string;
  label: string;
  topic: string;
  icon: string;
  tint: string;
}

// One query per category via topic: + sort=stars (Section 4). No trending scrape.
export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { key: "cli", label: "CLI Tools", topic: "cli", icon: "⌘", tint: "bg-rr-accentSoft text-rr-accent" },
  { key: "web", label: "Web Apps", topic: "web-app", icon: "🌐", tint: "bg-[#dafbe1] text-rr-tier3" },
  { key: "ml", label: "Machine Learning", topic: "machine-learning", icon: "✦", tint: "bg-[#f6f0ff] text-rr-tier2" },
  { key: "data", label: "Data Engineering", topic: "data-engineering", icon: "▤", tint: "bg-[#ddf4ff] text-rr-accent" },
  { key: "api", label: "APIs", topic: "api", icon: "{ }", tint: "bg-[#fff1e5] text-rr-tier4" },
  { key: "devtools", label: "Developer Tools", topic: "developer-tools", icon: "⚒", tint: "bg-rr-surfaceAlt text-rr-muted" },
  { key: "automation", label: "Automation", topic: "automation", icon: "↻", tint: "bg-rr-accentSoft text-rr-accent" },
  { key: "security", label: "Security", topic: "security", icon: "🛡", tint: "bg-[#fff1e5] text-rr-tier4" },
  { key: "agents", label: "AI Agents", topic: "ai-agents", icon: "◈", tint: "bg-[#f6f0ff] text-rr-tier2" },
  { key: "games", label: "Games", topic: "game", icon: "▶", tint: "bg-[#dafbe1] text-rr-tier3" },
];
