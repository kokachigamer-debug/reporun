import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores";
import { TopBar } from "@/components/layout/TopBar";
import {
  Badge,
  Button,
  Card,
  Spinner,
} from "@/components/shared";
import {
  EXEC_TIMEOUT_SECS,
  AGENT_IDLE_CEILING_MS,
  TIER_DESCRIPTIONS,
} from "@/lib/constants";
import { tierBadgeClass } from "@/lib/formatters";
import {
  buildAndRun,
  composeUp,
  detectExposedPort,
  findCliArgs,
  runCliTool,
  stopContainer,
  type ContainerRunInfo,
  type DetectedArg,
  type RunOutcome,
} from "@/lib/commands";

export function GeneratedInterface() {
  const { session, outputLog, appendOutput, setSession, setPhase } =
    useSessionStore();
  const [args, setArgs] = useState<DetectedArg[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunOutcome | null>(null);
  const [container, setContainer] = useState<ContainerRunInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tier = session.classification?.tier;
  const folder = session.folderPath;

  useEffect(() => {
    if (folder && tier === "Tier 1") {
      findCliArgs(folder)
        .then((a) => {
          setArgs(a);
          const init: Record<string, string> = {};
          a.forEach((x) => (init[x.name] = ""));
          setFormValues(init);
        })
        .catch(() => setArgs([]));
    }
  }, [folder, tier]);

  // Agent repos get Start/Stop instead of Run (Section 21).
  const isLongRunning = session.agent?.longRunning ?? false;

  async function runTier1() {
    if (!folder || !session.classification?.entryFile) {
      setError("No entry file detected for this Tier 1 repo.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    appendOutput(`[run] ${session.classification.entryFile}`);
    try {
      const runtime = session.classification.entryFile?.endsWith(".py")
        ? "python"
        : "node";
      const outcome = await runCliTool({
        folderPath: folder,
        entryFile: session.classification.entryFile,
        runtime,
        args: Object.entries(formValues).flatMap(([k, v]) =>
          v ? [`--${k}`, v] : [],
        ),
        env: { ...secretValues },
        timeoutSecs: isLongRunning
          ? Math.floor(AGENT_IDLE_CEILING_MS / 1000)
          : EXEC_TIMEOUT_SECS,
      });
      setResult(outcome);
      outcome.stdout.split("\n").forEach((l) => l && appendOutput(l));
      if (outcome.stderr) outcome.stderr.split("\n").forEach((l) => l && appendOutput(l));
      setPhase(outcome.timedOut ? "error" : "done");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runTier2() {
    if (!folder) return;
    setRunning(true);
    setError(null);
    try {
      const port = await detectExposedPort(folder).catch(() => 8080);
      appendOutput(`[docker] detected EXPOSE ${port}`);
      const info = await buildAndRun({
        folderPath: folder,
        tag: `reporun-${Date.now()}`,
        hostPort: 0, // dynamic — required fix (Section 3.10)
        containerPort: port,
        compose: false,
      });
      setContainer(info);
      setSession({ container: info, phase: "running" });
      appendOutput(`[docker] live at http://localhost:${info.hostPort}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase("error");
    } finally {
      setRunning(false);
    }
  }

  async function runTier4() {
    if (!folder) return;
    setRunning(true);
    setError(null);
    try {
      await composeUp(folder);
      setSession({ phase: "running" });
      appendOutput(`[compose] stack up at ${folder}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  async function stop() {
    if (container) {
      try {
        await stopContainer(container.containerId);
        appendOutput(`[docker] stopped ${container.containerId}`);
        setPhase("stopped");
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    }
  }

  const scan = session.scan;
  const blockedByScan = !!(scan && !scan.ok);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Generated interface" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Card className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={tierBadgeClass(tier ?? "Unsupported")}>
                {tier}
              </Badge>
              <span className="text-xs text-rr-subtle">
                {tier ? TIER_DESCRIPTIONS[tier] : ""}
              </span>
            </div>
            {session.agent?.isAgentRepo ? (
              <Badge className="border-rr-tier2/30 bg-[#f6f0ff] text-rr-tier2">
                agent repo
              </Badge>
            ) : null}
          </Card>

          {blockedByScan ? (
            <Card className="border-rr-danger/30 bg-[#ffebe9]">
              <div className="text-sm font-medium text-rr-danger">
                Pre-flight scan flagged concerns
              </div>
              <ul className="mt-2 space-y-1 text-xs text-rr-danger">
                {scan?.findings.slice(0, 6).map((f, i) => (
                  <li key={i}>
                    <code className="rr-mono">{f.kind}</code> · {f.pattern} in{" "}
                    <code className="rr-mono">{f.file}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-rr-subtle">
                We scan for known risk patterns before running anything. Review before proceeding.
              </p>
            </Card>
          ) : null}

          {tier === "Tier 1" ? (
            <Card className="space-y-3">
              <div className="text-sm font-medium text-rr-text">
                Detected CLI arguments
              </div>
              {args.length === 0 ? (
                <p className="text-xs text-rr-subtle">
                  No CLI arguments detected. Run with defaults below.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {args.map((a) => (
                    <label key={a.name} className="block">
                      <span className="rr-mono text-xs text-rr-muted">
                        --{a.name}
                      </span>
                      <input
                        className="rr-input mt-0.5"
                        placeholder={a.help ?? ""}
                        value={formValues[a.name] ?? ""}
                        onChange={(e) =>
                          setFormValues((s) => ({
                            ...s,
                            [a.name]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {session.agent?.secrets.length ? (
                <div className="space-y-2 border-t border-rr-hairline pt-3">
                  <div className="text-xs font-medium text-rr-muted">
                    Secrets (written to a repo-scoped config file)
                  </div>
                  {session.agent.secrets.map((s) => (
                    <label key={s} className="block">
                      <span className="rr-mono text-xs text-rr-muted">
                        {s}
                      </span>
                      <input
                        type="password"
                        className="rr-input mt-0.5"
                        value={secretValues[s] ?? ""}
                        onChange={(e) =>
                          setSecretValues((sv) => ({
                            ...sv,
                            [s]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-inline border border-rr-danger/30 bg-[#ffebe9] px-3 py-2 text-xs text-rr-danger">
                  {error}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Button onClick={runTier1} disabled={running || blockedByScan}>
                  {running ? "Running…" : isLongRunning ? "Start" : "Run"}
                </Button>
                {isLongRunning && container ? (
                  <Button variant="danger" onClick={stop}>
                    Stop
                  </Button>
                ) : null}
                <span className="text-[11px] text-rr-subtle">
                  {isLongRunning
                    ? "Long-running: 24h idle ceiling"
                    : `One-shot: ${EXEC_TIMEOUT_SECS}s ceiling`}
                </span>
              </div>
            </Card>
          ) : null}

          {(tier === "Tier 2" || tier === "Tier 3") ? (
            <Card className="space-y-3">
              {tier === "Tier 3" ? (
                <div className="rounded-inline border border-rr-tier3/30 bg-[#dafbe1] px-3 py-2 text-xs text-rr-tier3">
                  GPU workload detected — ensure your machine has compatible
                  hardware (first-run check in Settings).
                </div>
              ) : null}
              {container ? (
                <div className="rounded-inline border border-rr-tier3/30 bg-[#dafbe1] px-3 py-2 text-xs text-rr-tier3">
                  Live at{" "}
                  <code className="rr-mono">
                    http://localhost:{container.hostPort}
                  </code>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-inline border border-rr-danger/30 bg-[#ffebe9] px-3 py-2 text-xs text-rr-danger">
                  {error}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Button onClick={runTier2} disabled={running || blockedByScan}>
                  {running ? "Building…" : "Build & Run"}
                </Button>
                {container ? (
                  <>
                    <Button variant="ghost" onClick={() => window.open(`http://localhost:${container.hostPort}`)}>
                      Open in Browser
                    </Button>
                    <Button variant="danger" onClick={stop}>
                      Stop
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}

          {tier === "Tier 4" ? (
            <Card className="space-y-3">
              <p className="text-xs text-rr-subtle">
                Multi-service stack — <code className="rr-mono">docker compose up -d</code>.
              </p>
              {error ? (
                <div className="rounded-inline border border-rr-danger/30 bg-[#ffebe9] px-3 py-2 text-xs text-rr-danger">
                  {error}
                </div>
              ) : null}
              <Button onClick={runTier4} disabled={running || blockedByScan}>
                {running ? "Composing…" : "Bring up stack"}
              </Button>
            </Card>
          ) : null}

          {tier === "Unsupported" ? (
            <Card>
              <p className="text-sm text-rr-muted">
                No recognized entrypoint or container file. Paste a different
                repo or run it manually outside RepoRun.
              </p>
            </Card>
          ) : null}

          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-rr-text">
                Output log
              </span>
              <Button
                variant="ghost"
                onClick={() => useSessionStore.getState().clearOutput()}
              >
                Clear
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-inline bg-rr-surfaceAlt p-3 font-mono text-[12px] leading-relaxed text-rr-text">
              {outputLog.length ? outputLog.join("\n") : "(no output yet)"}
            </pre>
            {result ? (
              <div className="text-[11px] text-rr-subtle">
                exit {result.exitCode ?? "n/a"} ·{" "}
                {result.timedOut ? "timed out" : result.success ? "ok" : "error"}
              </div>
            ) : null}
          </Card>

          <div className="text-center">
            <Button variant="ghost" className="text-rr-subtle">
              Report misclassification
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

void Spinner;
