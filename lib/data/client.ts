/**
 * Canonical Supabase clients for the Data Access Layer.
 *
 * Functions in lib/data/ use these — they re-export the existing server + admin
 * clients from lib/supabase/. Files outside lib/data/ MUST NOT import from
 * here; they must call typed functions from @/lib/data/ instead.
 *
 * See docs/DATA_ACCESS_LAYER.md for the contract.
 */

export { createClient as createServerClient } from '@/lib/supabase/server'
export { createServiceClient } from '@/lib/supabase/service'

import { createClient as _createServerClient } from '@/lib/supabase/server'
import { createClient as _createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client — use for all read queries inside DAL functions.
 * Built lazily so unstable_cache wrappers can call it without import-time side
 * effects.
 */
export async function supabaseServer() {
  return await _createServerClient()
}

let _anonClient: SupabaseClient | null = null

/**
 * Anon (public RLS) Supabase client — use for hot-path reads against
 * materialized views and tables with public RLS. Skips the auth cookie
 * roundtrip; slightly faster for reads that don't need user context.
 *
 * Module-level singleton (same pattern as createServiceClient in
 * lib/supabase/service.ts): the client is stateless — anon key, no session —
 * so one instance is safe to share, and ~137 DAL call sites no longer build a
 * fresh client (auth/postgrest/realtime sub-clients included) per call.
 *
 * Returns null if env vars are missing so DAL functions can degrade
 * gracefully instead of throwing at build time.
 */
export function supabaseAnon(): SupabaseClient | null {
  if (_anonClient) return _anonClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  _anonClient = _createSupabaseClient(url, anonKey)
  return _anonClient
}
