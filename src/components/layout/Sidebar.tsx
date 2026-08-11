import { type ReactNode } from "react";
import { useNavStore } from "@/stores";
import type { NavSection } from "@/types";
import { Badge } from "@/components/shared";

interface NavItem {
  key: NavSection;
  label: string;
  icon: ReactNode;
}

const ICONS: Record<string, string> = {
  home: "⌂",
  explore: "⌕",
  projects: "▤",
  settings: "⚙",
  support: "✦",
  download: "↓",
};

const NAV: NavItem[] = [
  { key: "home", label: "Home", icon: <span>{ICONS.home}</span> },
  { key: "explore", label: "Explore", icon: <span>{ICONS.explore}</span> },
  { key: "projects", label: "Projects", icon: <span>{ICONS.projects}</span> },
  { key: "settings", label: "Settings", icon: <span>{ICONS.settings}</span> },
  { key: "support", label: "Support", icon: <span>{ICONS.support}</span> },
  { key: "download", label: "Download", icon: <span>{ICONS.download}</span> },
];

export function Sidebar() {
  const active = useNavStore((s) => s.active);
  const set = useNavStore((s) => s.set);
  return (
    <aside className="flex h-full w-56 flex-col border-r border-rr-hairline bg-rr-canvas">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-inline bg-rr-accent text-white">
          <span className="text-sm font-bold">R</span>
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-rr-text">RepoRun</div>
          <div className="text-[10px] uppercase tracking-wide text-rr-subtle">
            Run repos locally
          </div>
        </div>
      </div>
      <nav className="mt-1 flex-1 px-2">
        {NAV.map((n) => {
          const on = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => set(n.key)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-inline px-3 py-2 text-sm transition-colors ${
                on
                  ? "bg-rr-accentSoft text-rr-accent"
                  : "text-rr-muted hover:bg-rr-surfaceAlt"
              }`}
            >
              <span className="text-base leading-none">{n.icon}</span>
              <span className="font-medium">{n.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3">
        <Badge className="w-full justify-center text-rr-subtle">
          v0.1.0 · unsigned build
        </Badge>
      </div>
    </aside>
  );
}
