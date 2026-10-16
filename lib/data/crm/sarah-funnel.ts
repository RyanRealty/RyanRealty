/**
 * Sarah funnel stages on the visitor CRM session.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { SarahFunnelStage, SarahIntent } from '@/lib/sarah/intent-flow'

export const SARAH_FUNNEL_STAGES: SarahFunnelStage[] = [
  'opened',
  'intent',
  'name',
  'contact',
  'consent',
]

export async function insertSarahFunnelEvent(input: {
  sessionId: string
  stage: SarahFunnelStage
  intent?: SarahIntent | null
  personId?: number | null
  pageUrl?: string | null
  payload?: Record<string, unknown>
}): Promise<{ id: number | null; error: string | null }> {
  const sessionId = input.sessionId.trim()
  if (!sessionId) return { id: null, error: 'session_id required' }
  if (!SARAH_FUNNEL_STAGES.includes(input.stage)) return { id: null, error: 'unknown stage' }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('sarah_funnel_events')
      .insert({
        session_id: sessionId,
        stage: input.stage,
        intent: input.intent ?? null,
        person_id: input.personId ?? null,
        page_url: input.pageUrl ?? null,
        payload: input.payload ?? {},
      })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[insertSarahFunnelEvent]', error.message)
      return { id: null, error: error.message }
    }
    return { id: typeof data?.id === 'number' ? data.id : null, error: null }
  } catch (err) {
    console.error('[insertSarahFunnelEvent]', err)
    return { id: null, error: 'Could not log funnel' }
  }
}
