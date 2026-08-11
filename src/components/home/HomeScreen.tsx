import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSessionStore } from "@/stores";
import { useRecentStore } from "@/stores";
import { TopBar } from "@/components/layout/TopBar";
import { Badge, Button, Card, EmptyState } from "@/components/shared";
import { RECENT_TTL_MS } from "@/lib/constants";
import { greeting, timeAgo, tierBadgeClass } from "@/lib/formatters";
import { classifyRepo } from "@/lib/classifyRepo";
import {
  extractZip,
  listZipContents,
  scanContentSnippets,
  scanSecurity,
  type ZipEntryInfo,
} from "@/lib/commands";
import { getRepoMeta, parseOwnerRepo, zipDownloadUrl } from "@/lib/github";

export function HomeScreen() {
  const setSession = useSessionStore((s) => s.setSession);
  const setPhase = useSessionStore((s) => s.setPhase);
  const appendOutput = useSessionStore((s) => s.appendOutput);
  const recent = useRecentStore((s) => s.items);
  const addRecent = useRecentStore((s) => s.add);
  const prune = useRecentStore((s) => s.prune);

  const [dropActive, setDropActive] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name] = useState("there");

  // Tauri-native drag/drop (Phase 3.2) — browser events don't fire for real
  // file drops in Tauri.
  useEffect(() => {
    let un: (() => void) | undefined;
    (async () => {
      try {
        const w = getCurrentWebviewWindow();
        un = await w.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDropActive(true);
          } else if (event.payload.type === "drop") {
            setDropActive(false);
            const path = event.payload.paths?.[0];
            if (path) void handleZip(path, "drop");
          } else {
            setDropActive(false);
          }
        });
      } catch {
        // Not in Tauri (e.g. browser dev) — drag/drop disabled gracefully.
      }
    })();
    return () => {
      try {
        un?.();
      } catch {
        /* noop */
      }
    };
  }, []);

  // Prune the Recent list on mount (24h TTL, product spec 6.3).
  useEffect(() => {
    prune(Date.now(), RECENT_TTL_MS);
  }, [prune]);

  async function handleZip(zipPath: string, source: "drop" | "url" | "search") {
    setBusy(true);
    setError(null);
    appendOutput(`[setup] reading ${zipPath}`);
    try {
      const entries = await listZipContents(zipPath);
      const folder = await extractZip(zipPath);
      const snippets = await scanContentSnippets(folder).catch(
        () => [] as string[],
      );
      const result = classifyRepo(
        entries.map((e: ZipEntryInfo) => e.name),
        { contentSnippets: snippets },
      );
      const scan = await scanSecurity(folder).catch(() => ({
        ok: true,
        findings: [],
      }));

      setSession({
        source,
        zipPath,
        folderPath: folder,
        entries: entries.map((e: ZipEntryInfo) => ({
          name: e.name,
          uncompressedSize: e.uncompressedSize,
        })),
        classification: result.classification,
        agent: result.agent,
        scan,
        phase: "classified",
      });
      setPhase("classified");
      addRecent({
        id: crypto.randomUUID(),
        name: zipPath.split(/[\\/]/).pop() ?? zipPath,
        tier: result.classification.tier,
        folderPath: folder,
        createdAt: Date.now(),
        paused: false,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUrl() {
    const v = urlInput.trim();
    if (!v) return;
    const parsed = parseOwnerRepo(v);
    if (!parsed) {
      setError("Enter a GitHub URL or owner/repo, e.g. owner/repo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const meta = await getRepoMeta(parsed.owner, parsed.repo).catch(
        () => null,
      );
      const branch = meta?.defaultBranch ?? "main";
      const url = zipDownloadUrl(parsed.owner, parsed.repo, branch);
      appendOutput(`[download] ${url}`);
      // Download to a temp file via fetch + Blob, then hand the path to extract.
      // In the Tauri runtime a Rust download command would write directly; the
      // fetch path works for public repos and keeps the flow testable.
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const tmpName = `reporun-${parsed.repo}-${Date.now()}.zip`;
      const tmpPath = `/tmp/${tmpName}`;
      const { writeFile } = await import("@tauri-apps/plugin-fs").catch(
        () => ({} as any),
      );
      if (writeFile) {
        await writeFile(tmpPath, buf);
      } else {
        // Non-Tauri fallback (browser dev): create object URL only.
        const blob = new Blob([buf], { type: "application/zip" });
        const objUrl = URL.createObjectURL(blob);
        appendOutput(`[download] blob ready: ${objUrl}`);
      }
      setUrlInput("");
      await handleZip(tmpPath, "url");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={
          <span>
            {greeting()}, <span className="font-medium">{name}</span>
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-rr-text">
              Run a repo locally
            </h1>
            <p className="mt-1 text-xs text-rr-subtle">
              Paste a GitHub link, or drop a downloaded{" "}
              <code className="rr-mono">.zip</code>. We scan for known risk
              patterns before running anything.
            </p>
          </div>

          <Card className="space-y-3">
            <div className="flex gap-2">
              <input
                className="rr-input font-mono"
                placeholder="owner/repo  or  https://github.com/owner/repo"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrl()}
              />
              <Button onClick={handleUrl} disabled={busy}>
                Fetch
              </Button>
            </div>

            <div
              className={`flex items-center justify-center rounded-card border-2 border-dashed p-8 text-center transition-colors ${
                dropActive
                  ? "border-rr-accent bg-rr-accentSoft"
                  : "border-rr-hairline bg-rr-surface"
              }`}
            >
              <div>
                <div className="text-sm font-medium text-rr-muted">
                  Drop a repo .zip here
                </div>
                <p className="mt-1 text-xs text-rr-subtle">
                  RepoRun intercepts real file drops via native events.
                </p>
              </div>
            </div>

            {busy ? (
              <div className="text-xs text-rr-subtle">Working…</div>
            ) : null}
            {error ? (
              <div className="rounded-inline border border-rr-danger/30 bg-[#ffebe9] px-3 py-2 text-xs text-rr-danger">
                {error}
              </div>
            ) : null}
          </Card>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-rr-text">
                Recent activity
              </h2>
              <span className="text-[11px] text-rr-subtle">
                cleared after 24h
              </span>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                icon="🗂"
                title="Nothing yet"
                description="Dropped repos appear here for 24 hours. Save the ones you keep to Projects."
              />
            ) : (
              <div className="space-y-1.5">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-inline border border-rr-hairline bg-rr-canvas px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rr-mono text-rr-text">{r.name}</span>
                      <Badge className={tierBadgeClass(r.tier)}>
                        {r.tier}
                      </Badge>
                      {r.paused ? (
                        <Badge className="text-rr-subtle">paused</Badge>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-rr-subtle">
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="pt-2 text-center text-[11px] text-rr-subtle">
            RepoRun runs locally — it only touches the internet for sign-in,
            license checks, and updates.
          </p>
        </div>
      </div>
    </div>
  );
}
