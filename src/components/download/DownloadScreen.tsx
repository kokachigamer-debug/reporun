import { TopBar } from "@/components/layout/TopBar";
import { Button, Card } from "@/components/shared";
import { APP_VERSION } from "@/lib/constants";

interface Artifact {
  name: string;
  filename: string;
  size: string;
  platform: string;
  arch: string;
  desc: string;
  note?: string;
}

const ARTIFACTS: Artifact[] = [
  {
    name: "Debian package",
    filename: "RepoRun_0.1.0_amd64.deb",
    size: "3.3 MB",
    platform: "Linux (Debian/Ubuntu)",
    arch: "x86_64 (amd64)",
    desc: "Installs system-wide with .desktop entry and icons. Install with: sudo dpkg -i RepoRun_0.1.0_amd64.deb",
  },
  {
    name: "Standalone binary",
    filename: "reporun-linux-amd64",
    size: "7.3 MB",
    platform: "Linux (any glibc 2.31+)",
    arch: "x86_64",
    desc: "Single executable with no installer. Run directly after download (chmod +x).",
    note: "Requires webkit2gtk-4.1 + gtk-3 system libraries.",
  },
];

function installerUrl(filename: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/${filename}`;
  }
  return `./${filename}`;
}

export function DownloadScreen() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="Download RepoRun" />
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-5 py-6">
        <Card className="mb-6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                RepoRun {APP_VERSION}
              </h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Native desktop installer for Linux. Windows and macOS builds
                require code-signing certs — see the pre-launch items in
                README.md.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          {ARTIFACTS.map((a) => (
            <Card key={a.filename} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {a.name}
                    </h2>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      {a.arch}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {a.platform} · {a.size}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                    {a.desc}
                  </p>
                  {a.note ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {a.note}
                    </p>
                  ) : null}
                  <code className="mt-2 block break-all rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                    {installerUrl(a.filename)}
                  </code>
                </div>
                <a
                  href={installerUrl(a.filename)}
                  download={a.filename}
                  className="shrink-0"
                >
                  <Button>Download</Button>
                </a>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-5">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Install (Debian)
          </h3>
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100 dark:bg-black">
            <code>{`sudo dpkg -i RepoRun_0.1.0_amd64.deb
sudo apt-get install -f   # install missing dependencies
reporun                  # launch`}</code>
          </pre>
        </Card>

        <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-500">
          These artifacts are unsigned. Code signing is a tracked pre-launch
          addition — see docs/security-tooling.md.
        </p>
      </div>
    </div>
  );
}
