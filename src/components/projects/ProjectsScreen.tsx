import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Button,
  Card,
  EmptyState,
  Badge,
} from "@/components/shared";
import { useProjectsStore } from "@/stores";
import { timeAgo, tierBadgeClass } from "@/lib/formatters";

export function ProjectsScreen() {
  const projects = useProjectsStore((s) => s.projects);
  const remove = useProjectsStore((s) => s.remove);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Projects" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-xs text-rr-subtle">
            Saved projects persist their extracted folder + config until you
            delete them. Recent items clear after 24h; saved projects don’t.
          </p>
          {projects.length === 0 ? (
            <EmptyState
              icon="▤"
              title="No saved projects"
              description="Run a repo and choose “Save to Projects” to keep it around."
            />
          ) : (
            projects.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rr-mono text-rr-text">{p.name}</span>
                    <Badge className={tierBadgeClass(p.tier)}>{p.tier}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-rr-subtle">
                    last used {timeAgo(p.lastUsedAt)} ·{" "}
                    <code className="rr-mono">{p.folderPath}</code>
                  </div>
                </div>
                {confirmId === p.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rr-muted">Delete?</span>
                    <Button
                      variant="danger"
                      onClick={() => {
                        remove(p.id);
                        setConfirmId(null);
                      }}
                    >
                      Confirm
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmId(p.id)}>
                    Delete
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
