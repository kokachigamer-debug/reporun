import { TopBar } from "@/components/layout/TopBar";
import { Badge, Button, Card, Spinner } from "@/components/shared";
import { useExploreCategory } from "@/queries/github";
import { isLowSignal } from "@/lib/github";
import type { ExploreCategory } from "@/lib/constants";

export function ExploreCategoryDetail({
  category,
  onBack,
}: {
  category: ExploreCategory;
  onBack: () => void;
}) {
  const { data, isLoading, error, isFetching } = useExploreCategory(category.topic);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={
          <button onClick={onBack} className="flex items-center gap-2 text-rr-muted hover:text-rr-text">
            <span>←</span>
            <span>Explore</span>
            <span className="text-rr-subtle">/</span>
            <span className="font-medium text-rr-text">{category.label}</span>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner label="Querying GitHub Search API…" />
            </div>
          ) : error ? (
            <Card>
              <p className="text-sm text-rr-danger">
                Could not load results. Rate-limited? Try again in a few minutes, or paste a repo link directly on Home.
              </p>
            </Card>
          ) : (
            (data ?? []).map((repo, i) => (
              <Card key={repo.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs text-rr-subtle">
                      #{i + 1}
                    </span>
                    <span className="rr-mono truncate text-rr-text">
                      {repo.fullName}
                    </span>
                    <Badge className="text-rr-subtle">★ {repo.stars}</Badge>
                  </div>
                  {repo.description ? (
                    <p className="mt-1 line-clamp-2 pl-7 text-xs text-rr-subtle">
                      {repo.description}
                    </p>
                  ) : null}
                  {isLowSignal(repo.stars, repo.updatedAt, 1) ? (
                    <p className="mt-1 pl-7 text-[11px] text-rr-warn">
                      Low-signal repo: few stars, low activity — review before running.
                    </p>
                  ) : null}
                </div>
                <Button variant="ghost" className="shrink-0">
                  Run →
                </Button>
              </Card>
            ))
          )}
          {isFetching && !isLoading ? (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
