import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, Spinner, Badge } from "@/components/shared";
import { EXPLORE_CATEGORIES } from "@/lib/constants";
import { ExploreCategoryDetail } from "@/components/explore/ExploreCategoryDetail";

export function ExploreScreen() {
  const [active, setActive] = useState<string | null>(null);

  if (active) {
    const cat = EXPLORE_CATEGORIES.find((c) => c.key === active)!;
    return <ExploreCategoryDetail category={cat} onBack={() => setActive(null)} />;
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Explore" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-lg font-semibold text-rr-text">
            Browse by category
          </h1>
          <p className="mt-1 text-xs text-rr-subtle">
            Curated via the GitHub Search API (<code className="rr-mono">topic:</code> +{" "}
            <code className="rr-mono">sort=stars</code>). Results cached 15–30 min to respect rate limits.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {EXPLORE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className="group flex flex-col items-center gap-2 rounded-card border border-rr-hairline bg-rr-canvas p-4 transition-colors hover:border-rr-accent/40 hover:bg-rr-surface"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-card text-lg font-semibold ${c.tint}`}
                >
                  {c.icon}
                </span>
                <span className="text-xs font-medium text-rr-text">
                  {c.label}
                </span>
              </button>
            ))}
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-rr-text">
                  Sign in to GitHub for 3× the rate limit
                </div>
                <p className="mt-1 text-xs text-rr-subtle">
                  Optional and non-intrusive. 30 req/min when signed in vs. 10 unauthenticated.
                </p>
              </div>
              <Badge className="text-rr-subtle">optional</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

void Spinner;
