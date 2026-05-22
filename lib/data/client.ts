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

/**
 * Server-side Supabase client — use for all read queries inside DAL functions.
 * Built lazily so unstable_cache wrappers can call it without import-time side
 * effects.
 */
export async function supabaseServer() {
  return await _createServerClient()
}
