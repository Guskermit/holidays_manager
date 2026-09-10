import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security.
 *
 * Returns `null` if `SUPABASE_SERVICE_ROLE_KEY` is not set in the
 * environment, so callers can fall back to the regular client.
 *
 * Use ONLY in server-side code where RLS must be bypassed (e.g. creating
 * notifications on behalf of non-admin users).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}