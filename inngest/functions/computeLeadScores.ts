/**
 * Daily lead score computation. Apply points and decay, update profiles, push tier to FUB.
 * Step 18.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import { applyDecay, scoreToTier, activityTypeToPoints } from '@/lib/lead-scoring'
import { pushToFub } from '@/lib/fub'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

const BASE_DATE = new Date('2026-01-01')

export const computeLeadScores = inngest.createFunction(
  { id: 'leads/compute-scores', name: 'Compute lead scores', retries: 2 },
  { cron: '0 3 * * *' },
  async () => {
    const supabase = getSupabase()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: activities } = await supabase
      .from('user_activities')
      .select('user_id, activity_type, entity_type, entity_id, created_at')
      .gte('created_at', since)
      .not('user_id', 'is', null)
    const userIds = [...new Set((activities ?? []).map((a) => (a as { user_id: string }).user_id))]
    for (const userId of userIds) {
      const userActivities = (activities ?? []).filter((a) => (a as { user_id: string }).user_id === userId)
      let score = 0
      for (const a of userActivities) {
        const type = (a as { activity_type: string }).activity_type
        score += activityTypeToPoints(type)
      }
      const weeksSinceBase = (Date.now() - BASE_DATE.getTime()) / (7 * 24 * 60 * 60 * 1000)
      score = Math.round(applyDecay(score, Math.floor(weeksSinceBase)))
      const tier = scoreToTier(score)
      const { data: profile } = await supabase.from('profiles').select('lead_score, lead_tier').eq('id', userId).maybeSingle()
      const profileByUserId = profile ?? (await supabase.from('profiles').select('lead_score, lead_tier').eq('user_id', userId).maybeSingle()).data
      const prevTier = (profileByUserId as { lead_tier?: string } | null)?.lead_tier ?? 'cold'
      const updated = (await supabase.from('profiles').update({ lead_score: score, lead_tier: tier, updated_at: new Date().toISOString() }).eq('id', userId).select()).data?.length
      if (!updated) await supabase.from('profiles').update({ lead_score: score, lead_tier: tier, updated_at: new Date().toISOString() }).eq('user_id', userId)
      if (prevTier !== tier) {
        const { data: user } = await supabase.auth.admin.getUserById(userId)
        const email = user?.user?.email ?? ''
        if (email) await pushToFub('Lead Tier Updated', { email, customFields: { lead_score: score, lead_tier: tier } })
      }
    }
    return { processed: userIds.length }
  }
)
