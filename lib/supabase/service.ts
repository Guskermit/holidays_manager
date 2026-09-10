import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security.
 *
 * Use ONLY in server-side code where RLS must be bypassed (e.g. creating
 * notifications on behalf of non-admin users).
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` in the environment.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}