// Rule-based classification (Section 3.5) + confidence scoring + agent-repo
// signal detection (Section 21). Kept pure (no Tauri calls) so it is unit-testable.

import type {
  AgentSignals,
  Classification,
  RepoClassification,
  Tier,
} from "@/types";

const ENTRY_FILES: Record<string, string[]> = {
  dockerfile: ["dockerfile"],
  requirements: ["requirements.txt"],
  package: ["package.json"],
};

/** Normalize a path to its trailing filename (handles nested dirs). */
function basename(name: string): string {
  const cleaned = name.replace(/\\/g, "/");
  const parts = cleaned.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cleaned;
}

function hasFile(fileNames: string[], candidates: string[]): boolean {
  const lower = new Set(
    fileNames.map((n) => basename(n).toLowerCase().trim()),
  );
  return candidates.some((c) => lower.has(c.toLowerCase()));
}

function hasSuffix(fileNames: string[], suffix: string): boolean {
  const s = suffix.toLowerCase();
  return fileNames.some((n) => basename(n).toLowerCase().endsWith(s));
}

/** True when file content patterns (provided by Rust find_cli_args style scan)
 * would indicate a long-running server/agent. Here we use filename + lightweight
 * content hints passed in by the caller. */
function detectLongRunning(fileNames: string[], readme: string | null): boolean {
  const names = fileNames.map((n) => basename(n).toLowerCase());
  const looksLikeServer = names.some(
    (n) =>
      n.includes("app.py") ||
      n.includes("server.py") ||
      n.includes("main.py") ||
      n.includes("index.js") ||
      n.includes("server.js") ||
      n.includes("app.ts"),
  );
  const readmeHints = readme
    ? /fastapi|flask|express|uvicorn|gunicorn|langchain|crewai|autogen|chat loop|event loop/i.test(
        readme,
      )
    : false;
  return looksLikeServer || readmeHints;
}

/** Detect agent-framework signals from imports/content snippets (Section 21). */
function detectAgentSignals(
  fileNames: string[],
  contentSnippets: string[],
): { isAgentRepo: boolean; reasons: string[] } {
  const agentPatterns: RegExp[] = [
    /\bfrom\s+langchain\b/i,
    /\bimport\s+langchain\b/i,
    /\bfrom\s+crewai\b/i,
    /\bfrom\s+autogen\b/i,
    /openai\.(com|api)/i,
    /anthropic\.com/i,
    /@langchain\/core/,
    /from\s+llama_index/i,
  ];
  const blob = contentSnippets.join("\n");
  const reasons: string[] = [];
  if (agentPatterns.some((re) => re.test(blob))) {
    reasons.push("Agent-framework SDK import detected");
  }
  // API hostnames
  if (/api\.openai\.com|api\.anthropic\.com/i.test(blob)) {
    reasons.push("Known LLM API hostname detected");
  }
  if (fileNames.some((n) => /agent/i.test(basename(n)))) {
    reasons.push("Agent-named file present");
  }
  return { isAgentRepo: reasons.length > 0, reasons };
}

/** Detect env-var secret read patterns (Section 21 secrets signal). */
function detectSecrets(contentSnippets: string[]): string[] {
  const re =
    /(?:os\.environ(?:\.get)?\(|process\.env\.|getenv\()\s*["']([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|KEY)[A-Z0-9_]*)["']/gi;
  const found = new Set<string>();
  for (const snippet of contentSnippets) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(snippet)) !== null) {
      found.add(m[1]);
    }
  }
  // .env.example presence also signals secret slots
  return Array.from(found).sort();
}

function confidenceFromSignals(matched: Tier, signals: number): "high" | "low" {
  // High confidence = exactly one clear signal (one matched tier from one source).
  if (signals === 1 && matched !== "Unsupported") return "high";
  return "low";
}

/**
 * Pure classification used by the UI. Accepts the zip file list plus optional
 * content snippets (returned by the Rust content-scan command) so agent signals
 * can be layered on without a separate pipeline.
 */
export function classifyRepo(
  fileNames: string[],
  opts: { contentSnippets?: string[]; readme?: string | null } = {},
): RepoClassification {
  const snippets = opts.contentSnippets ?? [];
  const readme = opts.readme ?? null;

  // Note: spec lists docker-compose.yml as Tier 4, Dockerfile alone as Tier 2.
  if (hasSuffix(fileNames, "docker-compose.yml") ||
      hasSuffix(fileNames, "docker-compose.yaml") ||
      hasSuffix(fileNames, "compose.yml") ||
      hasSuffix(fileNames, "compose.yaml")) {
    return finalize(
      { tier: "Tier 4", reason: "docker-compose / compose file present", confidence: "high" },
      fileNames,
      snippets,
      readme,
    );
  }

  if (hasFile(fileNames, ENTRY_FILES.dockerfile)) {
    // Tier 3 = GPU workload if Dockerfile mentions CUDA / nvidia runtime.
    const dockerfile = snippets.find((s) => /cuda|nvidia|torch|tensorflow|gpu/i.test(s));
    const tier: Tier = dockerfile ? "Tier 3" : "Tier 2";
    return finalize(
      {
        tier,
        reason: dockerfile
          ? "Dockerfile references CUDA/GPU runtime"
          : "Dockerfile present (containerized app)",
        confidence: "high",
      },
      fileNames,
      snippets,
      readme,
    );
  }

  const hasPy = hasFile(fileNames, ENTRY_FILES.requirements);
  const hasNode = hasFile(fileNames, ENTRY_FILES.package);
  if (hasPy && hasNode) {
    // Conflicting signals -> low confidence, needs confirmation.
    return finalize(
      {
        tier: "Tier 1",
        reason: "Both requirements.txt and package.json present — confirm runtime",
        confidence: "low",
        entryFile: null,
      },
      fileNames,
      snippets,
      readme,
    );
  }
  if (hasPy) {
    return finalize(
      {
        tier: "Tier 1",
        reason: "Python requirements.txt present",
        confidence: "high",
        entryFile: pickEntry(fileNames, [".py"], ["main.py", "app.py", "run.py", "cli.py"]),
      },
      fileNames,
      snippets,
      readme,
    );
  }
  if (hasNode) {
    return finalize(
      {
        tier: "Tier 1",
        reason: "Node package.json present",
        confidence: "high",
        entryFile: pickEntry(fileNames, [".js", ".ts", ".mjs"], ["index.js", "main.js", "cli.js", "bin.js"]),
      },
      fileNames,
      snippets,
      readme,
    );
  }

  // Unmatched — keep a low-confidence marker so the confirmation screen is reachable.
  return finalize(
    {
      tier: "Unsupported",
      reason: "No recognized entrypoint or container file found",
      confidence: "low",
    },
    fileNames,
    snippets,
    readme,
  );
}

function pickEntry(
  fileNames: string[],
  suffixes: string[],
  preferred: string[],
): string | null {
  const byBase = new Set(fileNames.map((n) => basename(n).toLowerCase()));
  for (const p of preferred) {
    if (byBase.has(p.toLowerCase())) return p;
  }
  const match = fileNames.find((n) =>
    suffixes.some((s) => basename(n).toLowerCase().endsWith(s)),
  );
  return match ? basename(match) : null;
}

function finalize(
  c: Classification,
  fileNames: string[],
  snippets: string[],
  readme: string | null,
): RepoClassification {
  const agent = detectAgentSignals(fileNames, snippets);
  const secrets = detectSecrets(snippets);
  const longRunning =
    detectLongRunning(fileNames, readme) || agent.isAgentRepo;
  const agentSignals: AgentSignals = {
    isAgentRepo: agent.isAgentRepo,
    longRunning,
    secrets,
    reasons: agent.reasons,
  };
  return { classification: c, agent: agentSignals };
}

// Re-export for tests.
export const __testing = {
  basename,
  hasFile,
  hasSuffix,
  detectSecrets,
  detectAgentSignals,
  detectLongRunning,
  confidenceFromSignals,
  ENTRY_FILES,
};
