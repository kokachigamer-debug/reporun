import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Button, Card, Badge } from "@/components/shared";
import { useLicenseStatus } from "@/queries/auth";
import {
  detectContainerRuntime,
  detectRuntimes,
  exportDiagnostics,
  hardwareClass,
  type HardwareClass,
} from "@/lib/commands";
import type { RuntimeVersions } from "@/types";
import { useEffect } from "react";
import { APP_VERSION } from "@/lib/constants";

export function SettingsScreen() {
  const { data: license } = useLicenseStatus();
  const [rt, setRt] = useState<RuntimeVersions | null>(null);
  const [hw, setHw] = useState<HardwareClass | null>(null);
  const [container, setContainer] = useState<string | null>(null);
  const [diagPath, setDiagPath] = useState<string | null>(null);
  const [crashOptIn, setCrashOptIn] = useState(false);
  const [llmProvider, setLlmProvider] = useState("openai-compatible");
  const [llmKey, setLlmKey] = useState("");

  useEffect(() => {
    detectRuntimes().then(setRt).catch(() => {});
    hardwareClass().then(setHw).catch(() => {});
    detectContainerRuntime().then(setContainer).catch(() => setContainer(null));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Settings & account" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card className="space-y-2">
            <div className="text-sm font-medium text-rr-text">
              Subscription
            </div>
            <div className="flex items-center gap-2 text-xs text-rr-muted">
              Status:
              <Badge
                className={
                  license?.status === "valid"
                    ? "border-rr-tier3/30 bg-[#dafbe1] text-rr-tier3"
                    : "text-rr-subtle"
                }
              >
                {license?.status ?? "unknown"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button>Manage subscription</Button>
              <Button variant="ghost">Cancel (one-click)</Button>
            </div>
            <p className="text-[11px] text-rr-subtle">
              Cancellation is genuinely one-click, self-serve, in-app.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-medium text-rr-text">
              First-run system check
            </div>
            <p className="text-xs text-rr-subtle">
              Here’s what your machine can run.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">Python</span>
                <code className="rr-mono">{rt?.python ?? "— not found"}</code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">Node</span>
                <code className="rr-mono">{rt?.node ?? "— not found"}</code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">Docker</span>
                <code className="rr-mono">{rt?.docker ?? "— not found"}</code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">Podman</span>
                <code className="rr-mono">{rt?.podman ?? "— not found"}</code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">Container runtime</span>
                <code className="rr-mono">{container ?? "— will bundle Podman"}</code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">GPU signal</span>
                <code className="rr-mono">
                  {hw?.hasGpuSignal ? "detected" : "not detected"}
                </code>
              </div>
              <div className="flex justify-between rounded-inline bg-rr-surfaceAlt px-3 py-2">
                <span className="text-rr-muted">CPU / RAM</span>
                <code className="rr-mono">
                  {hw?.cpuCount ?? "—"} · {hw?.totalMemoryGb ?? "—"} GB
                </code>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-medium text-rr-text">
              Crash & diagnostics (opt-in)
            </div>
            <label className="flex items-center gap-2 text-xs text-rr-muted">
              <input
                type="checkbox"
                checked={crashOptIn}
                onChange={(e) => setCrashOptIn(e.target.checked)}
              />
              Send crash reports (stack traces, app/OS version, hardware class —
              never repo contents, form values, or tokens)
            </label>
            <Button
              variant="ghost"
              onClick={async () => {
                const p = await exportDiagnostics([
                  `version=${APP_VERSION}`,
                  `crashOptIn=${crashOptIn}`,
                ]);
                setDiagPath(p);
              }}
            >
              Export diagnostics bundle
            </Button>
            {diagPath ? (
              <p className="text-[11px] text-rr-subtle">
                Written to <code className="rr-mono">{diagPath}</code>
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-medium text-rr-text">
              LLM classification fallback (optional)
            </div>
            <p className="text-xs text-rr-subtle">
              Off by default. Bring your own API key — stored in the OS
              credential store, never logged or sent to crash reports.
            </p>
            <select
              className="rr-input"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
            >
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="anthropic">Anthropic</option>
            </select>
            <input
              type="password"
              className="rr-input"
              placeholder="API key"
              value={llmKey}
              onChange={(e) => setLlmKey(e.target.value)}
            />
          </Card>

          <Card className="space-y-2">
            <div className="text-sm font-medium text-rr-text">Account</div>
            <div className="flex gap-2">
              <Button variant="ghost">Sign out</Button>
              <a
                className="text-xs text-rr-accent hover:underline self-center"
                href="#"
              >
                Supported repository types
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
