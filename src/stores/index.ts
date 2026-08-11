// Zustand stores (Section 20). sessionStore holds the active drop/classification/
// execution state for the current Home session.

import { create } from "zustand";
import type {
  Classification,
  ContainerRun,
  RunResult,
  Tier,
  ZipEntry,
  SecurityScanResult,
  AgentSignals,
} from "@/types";

export type SessionPhase =
  | "idle"
  | "downloaded"
  | "listed"
  | "extracted"
  | "classified"
  | "scanned"
  | "running"
  | "stopped"
  | "done"
  | "error";

export interface ActiveSession {
  source: "drop" | "url" | "search" | null;
  zipPath: string | null;
  folderPath: string | null;
  entries: ZipEntry[];
  classification: Classification | null;
  agent: AgentSignals | null;
  scan: SecurityScanResult | null;
  phase: SessionPhase;
  lastRun: RunResult | null;
  container: ContainerRun | null;
  error: string | null;
}

interface SessionState {
  session: ActiveSession;
  outputLog: string[];
  setSession: (patch: Partial<ActiveSession>) => void;
  resetSession: () => void;
  appendOutput: (line: string) => void;
  clearOutput: () => void;
  setPhase: (p: SessionPhase) => void;
}

const initial: ActiveSession = {
  source: null,
  zipPath: null,
  folderPath: null,
  entries: [],
  classification: null,
  agent: null,
  scan: null,
  phase: "idle",
  lastRun: null,
  container: null,
  error: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  session: initial,
  outputLog: [],
  setSession: (patch) =>
    set((s) => ({ session: { ...s.session, ...patch } })),
  resetSession: () => set({ session: initial, outputLog: [] }),
  appendOutput: (line) =>
    set((s) => ({ outputLog: [...s.outputLog, line] })),
  clearOutput: () => set({ outputLog: [] }),
  setPhase: (p) =>
    set((s) => ({ session: { ...s.session, phase: p } })),
}));

interface NavState {
  active: "home" | "explore" | "projects" | "settings" | "support" | "download";
  set: (n: NavState["active"]) => void;
}
export const useNavStore = create<NavState>((set) => ({
  active: "home",
  set: (n) => set({ active: n }),
}));

interface ProjectsState {
  projects: import("@/types").SavedProject[];
  add: (p: import("@/types").SavedProject) => void;
  remove: (id: string) => void;
  load: (list: import("@/types").SavedProject[]) => void;
}
export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  add: (p) => set((s) => ({ projects: [p, ...s.projects] })),
  remove: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  load: (list) => set({ projects: list }),
}));

interface RecentState {
  items: import("@/types").RecentItem[];
  add: (r: import("@/types").RecentItem) => void;
  togglePause: (id: string) => void;
  remove: (id: string) => void;
  prune: (now: number, ttlMs: number) => void;
}
export const useRecentStore = create<RecentState>((set) => ({
  items: [],
  add: (r) => set((s) => ({ items: [r, ...s.items] })),
  togglePause: (id) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, paused: !i.paused } : i,
      ),
    })),
  remove: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  prune: (now, ttlMs) =>
    set((s) => ({
      items: s.items.filter((i) => now - i.createdAt < ttlMs),
    })),
}));

export type { Tier };
