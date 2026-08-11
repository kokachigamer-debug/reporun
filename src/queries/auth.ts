// Supabase session + license status query hooks (Section 20). These wrap the
// Supabase JS SDK when configured; in a build without env keys they resolve to
// a signed-out / unlicensed state so the UI remains functional.

import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as
  | string
  | undefined;
const SUPABASE_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

export function useSupabaseSession() {
  return useQuery({
    queryKey: ["supabase-session", supabaseConfigured],
    queryFn: async () => {
      // Lazy import so a build without the SDK still compiles if env is unset.
      if (!supabaseConfigured) {
        return { user: null, trialEndsAt: null as number | null };
      }
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(SUPABASE_URL!, SUPABASE_ANON!);
      const { data } = await sb.auth.getSession();
      const user = data.session?.user ?? null;
      // Trial end stored server-side (Section 9). Read from a profiles row.
      let trialEndsAt: number | null = null;
      if (user) {
        const r = await sb
          .from("profiles")
          .select("trial_ends_at")
          .eq("id", user.id)
          .maybeSingle();
        if (r.data?.trial_ends_at) {
          trialEndsAt = new Date(r.data.trial_ends_at).getTime();
        }
      }
      return { user, trialEndsAt };
    },
    staleTime: 1000 * 60,
    retry: 0,
  });
}

export function useLicenseStatus() {
  return useQuery({
    queryKey: ["license-status"],
    queryFn: async () => {
      // License validation on first activation + ~30-day re-check (Section 10).
      // Until the payment gateway key is wired this returns "unknown".
      return {
        status: "unknown" as "valid" | "trial" | "expired" | "unknown",
        recheckAt: null as number | null,
        offlineSince: null as number | null,
      };
    },
    staleTime: 1000 * 60 * 30,
  });
}
