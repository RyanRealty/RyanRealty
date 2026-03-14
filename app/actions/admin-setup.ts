'use server'

import { createClient } from '@supabase/supabase-js'

export async function getSetupComplete(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return false
  const supabase = createClient(url, anonKey)
  const { data } = await supabase.from('settings').select('value').eq('key', 'setup_complete').maybeSingle()
  if (!data || !data.value) return false
  const v = data.value as unknown
  return v === true || (typeof v === 'object' && v !== null && 'complete' in (v as object))
}

export async function setSetupComplete(): Promise<{ error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return { error: 'Server not configured' }
  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.from('settings').upsert(
    { key: 'setup_complete', value: { complete: true }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) return { error: error.message }
  return { error: null }
}
