import { useState } from "react";
import { Button, Card, Badge } from "@/components/shared";

export function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"signup" | "card">("signup");

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-rr-text">
            Create your RepoRun account
          </h1>
          <p className="mt-1 text-xs text-rr-subtle">
            Email + password. Trial starts after card capture via our
            merchant-of-record checkout.
          </p>
        </div>

        <div className="rounded-inline border border-rr-hairline bg-rr-surfaceAlt px-3 py-2 text-[11px] text-rr-muted">
          <strong className="text-rr-text">Device fingerprinting:</strong> we
          store a simple hardware-derived identifier alongside your account to
          flag — not silently block — trial reuse. We never collect repo
          contents or form values.
        </div>

        {stage === "signup" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStage("card");
            }}
            className="space-y-3"
          >
            <input
              className="rr-input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="rr-input"
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className="w-full">
              Continue to checkout
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <Badge className="border-rr-accent/30 bg-rr-accentSoft text-rr-accent">
              Card capture via Lemon Squeezy / Gumroad
            </Badge>
            <p className="text-xs text-rr-subtle">
              You’ll be redirected to the payment gateway’s hosted checkout.
              RepoRun never touches your card details.
            </p>
            <Button
              className="w-full"
              onClick={() => alert("Wire Lemon Squeezy / Gumroad checkout URL here.")}
            >
              Start trial
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStage("signup")}>
              Back
            </Button>
          </div>
        )}

        <p className="text-center text-[11px] text-rr-subtle">
          Cancel anytime, one-click, in-app. No strings attached.
        </p>
      </Card>
    </div>
  );
}
