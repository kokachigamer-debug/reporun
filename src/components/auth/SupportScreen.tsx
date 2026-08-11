import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Button, Card } from "@/components/shared";
import { exportDiagnostics } from "@/lib/commands";

export function SupportScreen() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    {
      role: "ai",
      text: "Hi — I’m the RepoRun support agent. Describe the issue and I’ll help, or escalate to a GitHub Issue with a diagnostics bundle if needed.",
    },
  ]);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    const next = [...messages, { role: "user" as const, text: input }];
    setMessages(next);
    setInput("");
    // Placeholder AI echo — real impl calls the configured LLM support agent.
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Thanks. If this is a crash, I can attach a privacy-safe diagnostics bundle to a GitHub Issue for you.",
        },
      ]);
    }, 400);
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Support" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-2xl flex-col">
          <Card className="flex-1 space-y-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] rounded-inline px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-rr-accent text-white"
                    : "bg-rr-surfaceAlt text-rr-text"
                }`}
              >
                {m.text}
              </div>
            ))}
          </Card>
          <div className="mt-3 flex gap-2">
            <input
              className="rr-input"
              placeholder="Describe the issue…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button onClick={send}>Send</Button>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              onClick={async () => {
                const p = await exportDiagnostics([
                  `escalation: support chat`,
                ]);
                alert(`Diagnostics bundle written to ${p}. Attach it to your GitHub Issue.`);
              }}
            >
              Escalate to GitHub Issue (with diagnostics)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
