/**
 * Supabase client with service role (bypasses RLS). Use only where server-side
 * admin/sync operations require it. For user-scoped server code, use createClient
 * from lib/supabase/server.ts (cookie-based).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _serviceClient: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  _serviceClient = createClient(url, key)
  return _serviceClient
}
