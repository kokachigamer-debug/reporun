import { Card, Button } from "@/components/shared";

export function UnsupportedTypeMessage({ onBack }: { onBack: () => void }) {
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h2 className="text-base font-semibold text-rr-text">
        Unsupported repository type
      </h2>
      <p className="text-sm text-rr-muted">
        RepoRun could not find a recognized entrypoint or container file in
        this repo. We support Python (requirements.txt), Node (package.json),
        single Dockerfiles, GPU Dockerfiles, and docker-compose stacks.
      </p>
      <p className="text-xs text-rr-subtle">
        See the full list of supported types in Settings → Supported types.
      </p>
      <Button onClick={onBack}>Back to Home</Button>
    </Card>
  );
}

export function HardwareCeilingMessage({
  reason,
  onBack,
}: {
  reason: string;
  onBack: () => void;
}) {
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h2 className="text-base font-semibold text-rr-text">
        This repo needs more than your machine can run
      </h2>
      <p className="text-sm text-rr-muted">{reason}</p>
      <p className="text-xs text-rr-subtle">
        RepoRun surfaces limits before running, not mid-execution. Check the
        first-run hardware summary in Settings.
      </p>
      <Button onClick={onBack}>Back to Home</Button>
    </Card>
  );
}

export function LowSignalWarning({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h2 className="text-base font-semibold text-rr-text">
        Low-signal repository
      </h2>
      <p className="text-sm text-rr-muted">
        This repo has few stars, low activity, and few contributors. We scan
        for known risk patterns before running anything — proceed only if you
        trust the source.
      </p>
      <div className="flex gap-2">
        <Button onClick={onContinue}>Proceed anyway</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export function NetworkDisclosure({
  hosts,
  onApprove,
  onCancel,
}: {
  hosts: string[];
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h2 className="text-base font-semibold text-rr-text">
        This agent repo requests network access
      </h2>
      <p className="text-sm text-rr-muted">
        Default-deny is in effect. Approve a scoped, one-time allowlist for the
        hosts below — never a blanket exception.
      </p>
      <ul className="space-y-1 text-xs text-rr-muted">
        {hosts.map((h) => (
          <li key={h}>
            <code className="rr-mono">{h}</code>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={onApprove}>Approve scoped allowlist</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export function TrialExpiredMessage({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <Card className="mx-auto max-w-lg space-y-3">
      <h2 className="text-base font-semibold text-rr-text">
        Trial or subscription expired
      </h2>
      <p className="text-sm text-rr-muted">
        Browsing and search remain unblocked — only running repos is gated.
        Subscribe to keep full access.
      </p>
      <Button onClick={onSubscribe}>Subscribe — $7/mo or $77/yr</Button>
    </Card>
  );
}

export function OfflineGraceIndicator({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-rr-warn/30 bg-[#fff8c5] px-3 py-1 text-[11px] text-rr-warn">
      <span>⚠</span>
      <span>
        Offline — license can’t be verified. Full access for{" "}
        <strong>{daysLeft}</strong> more day{daysLeft === 1 ? "" : "s"}.
      </span>
    </div>
  );
}
