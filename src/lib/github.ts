// GitHub API client (Section 4). Rate-limit aware with exponential backoff,
// in-session result caching handled by TanStack Query at the hook layer.

import {
  CODELOAD_BASE,
  GITHUB_API,
} from "@/lib/constants";
import type { GitHubRepoSummary } from "@/types";

export interface GitHubSearchResponse {
  total: number;
  items: GitHubRepoSummary[];
  rateLimited: boolean;
}

const isOwnerRepoRe = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

/** Detect owner/repo pattern or full URL before touching the search endpoint. */
export function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(isOwnerRepoRe);
  if (m) return { owner: m[1], repo: m[2] };
  // bare "owner/repo"
  const bare = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (bare) return { owner: bare[1], repo: bare[2] };
  return null;
}

async function githubFetch(path: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
}

async function withBackoff<T>(fn: () => Promise<Response>): Promise<T> {
  // Exponential backoff on transient failures (Section 23), capped retry count.
  const maxAttempts = 4;
  let delayMs = 500;
  let lastStatus = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fn();
    lastStatus = res.status;
    if (res.status === 200) return (await res.json()) as T;
    if (res.status === 403 || res.status === 429) {
      // rate limited — surface, don't retry past cap
      const retry = res.headers.get("retry-after");
      if (retry) await sleep(Math.min(parseInt(retry, 10) * 1000, 20000));
      else await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 8000);
      continue;
    }
    if (res.status >= 500) {
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 8000);
      continue;
    }
    throw new Error(`GitHub API ${res.status}`);
  }
  throw new Error(`GitHub API failed after retries (last ${lastStatus})`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function searchRepos(
  query: string,
  signal?: AbortSignal,
): Promise<GitHubSearchResponse> {
  try {
    const data = await withBackoff<{ total_count: number; items: any[] }>(() =>
      githubFetch(
        `/search/repositories?q=${encodeURIComponent(query)}&per_page=20&sort=stars`,
        signal,
      ),
    );
    return {
      total: data.total_count,
      items: data.items.map(mapRepo),
      rateLimited: false,
    };
  } catch (e: any) {
    if (/403|429/.test(e?.message)) {
      return { total: 0, items: [], rateLimited: true };
    }
    throw e;
  }
}

export async function exploreCategory(
  topic: string,
  signal?: AbortSignal,
): Promise<GitHubRepoSummary[]> {
  const data = await withBackoff<{ items: any[] }>(() =>
    githubFetch(
      `/search/repositories?q=topic:${encodeURIComponent(
        topic,
      )}&sort=stars&order=desc&per_page=30`,
      signal,
    ),
  );
  return data.items.map(mapRepo);
}

export async function getRepoMeta(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<GitHubRepoSummary | null> {
  const data = await withBackoff<any>(() => githubFetch(`/repos/${owner}/${repo}`, signal));
  return mapRepo(data);
}

export function zipDownloadUrl(
  owner: string,
  repo: string,
  branch: string,
): string {
  return `${CODELOAD_BASE}/${owner}/${repo}/zip/refs/heads/${branch}`;
}

function mapRepo(r: any): GitHubRepoSummary {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner?.login ?? "",
    description: r.description,
    stars: r.stargazers_count ?? 0,
    defaultBranch: r.default_branch ?? "main",
    updatedAt: r.updated_at,
    topics: r.topics ?? [],
  };
}

/** Low-signal repo warning (Section 22 #2): combine stars + age + contributors. */
export function isLowSignal(
  stars: number,
  updatedAt: string,
  contributors: number,
): boolean {
  const ageDays =
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return stars < 10 && contributors <= 1 && ageDays > 90;
}
