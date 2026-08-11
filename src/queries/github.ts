// TanStack Query hooks (Section 20): GitHub search, explore, repo description,
// Supabase session, license status. Caching satisfies the rate-limit requirement.

import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { exploreCategory, getRepoMeta, searchRepos } from "@/lib/github";
import { GITHUB_API } from "@/lib/constants";

const STALE_EXPLORE = 1000 * 60 * 20; // 20 min (Section 4: 15-30 min)
const STALE_SEARCH = 1000 * 60 * 2;

export function useGithubSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["gh-search", query],
    queryFn: ({ signal }) => searchRepos(query, signal),
    enabled: enabled && query.trim().length >= 3,
    placeholderData: keepPreviousData,
    staleTime: STALE_SEARCH,
    retry: 1,
  });
}

export function useExploreCategory(topic: string | null) {
  return useQuery({
    queryKey: ["gh-explore", topic],
    queryFn: ({ signal }) => exploreCategory(topic!, signal),
    enabled: !!topic,
    staleTime: STALE_EXPLORE,
    retry: 2,
  });
}

export function useRepoDescription(owner: string, repo: string) {
  return useQuery({
    queryKey: ["gh-repo", owner, repo],
    queryFn: async () => {
      const meta = await getRepoMeta(owner, repo);
      return meta?.description ?? null;
    },
    enabled: !!owner && !!repo,
    staleTime: STALE_EXPLORE,
  });
}

/** Optional GitHub auth status (Section 4: 30 req/min if signed in). */
export function useGithubAuthStatus(token: string | null) {
  return useQuery({
    queryKey: ["gh-authed", !!token],
    queryFn: async () => {
      if (!token) return { authed: false };
      const res = await fetch(`${GITHUB_API}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { authed: res.ok };
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });
}
