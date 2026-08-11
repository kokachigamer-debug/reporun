// Shared TypeScript types for RepoRun frontend.

export type Tier = "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4" | "Unsupported";

export interface Classification {
  tier: Tier;
  reason: string;
  /** High confidence = exactly one clear signal. Low confidence routes to the
   * confirmation screen (Section 19.2 #7) before any setup begins. */
  confidence: "high" | "low";
  entryFile?: string | null;
}

export interface CliArg {
  name: string;
  /** Help/description text if discoverable (argparse -h, commander .description). */
  help?: string | null;
  required?: boolean;
}

/** Signals layered onto classification for agent-repo handling (Section 21). */
export interface AgentSignals {
  isAgentRepo: boolean;
  longRunning: boolean;
  secrets: string[];
  reasons: string[];
}

export interface RepoClassification {
  classification: Classification;
  agent: AgentSignals;
}

export interface RuntimeVersions {
  python: string | null;
  node: string | null;
  docker: string | null;
  podman: string | null;
}

export interface ZipEntry {
  name: string;
  uncompressedSize: number;
}

export interface DiskSpaceInfo {
  availableBytes: number;
  requiredBytes: number;
  ok: boolean;
}

export interface RunResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ContainerRun {
  containerId: string;
  hostPort: number;
  containerPort: number;
  tag: string;
}

export interface SecurityScanResult {
  ok: boolean;
  findings: SecurityFinding[];
}

export interface SecurityFinding {
  kind: "secret" | "malware" | "suspicious";
  file: string;
  pattern: string;
}

export interface SavedProject {
  id: string;
  name: string;
  tier: Tier;
  folderPath: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface RecentItem {
  id: string;
  name: string;
  tier: Tier;
  folderPath: string;
  createdAt: number;
  paused: boolean;
  containerId?: string | null;
}

export type NavSection =
  | "home"
  | "explore"
  | "projects"
  | "settings"
  | "support"
  | "download";

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  stars: number;
  defaultBranch: string;
  updatedAt: string;
  topics: string[];
}

export interface SetupStage {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  etaSeconds: number | null;
}
