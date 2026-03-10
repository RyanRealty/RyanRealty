'use server'

import { createClient } from '@/lib/supabase/server'

export type ViewListingRow = {
  id: string
  entity_id: string
  created_at: string
}

/** Recent listing views for the current user from user_activities. Returns up to limit (default 100). */
export async function getRecentListingViews(limit = 100): Promise<ViewListingRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_activities')
    .select('id, entity_id, created_at')
    .eq('user_id', user.id)
    .eq('activity_type', 'view_listing')
    .eq('entity_type', 'listing')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as ViewListingRow[]
}
