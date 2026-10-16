'use server'

import { insertSarahFunnelEvent } from '@/lib/data/crm/sarah-funnel'
import type { SarahFunnelStage, SarahIntent } from '@/lib/sarah/intent-flow'

export async function recordSarahFunnelStage(input: {
  sessionId: string
  stage: SarahFunnelStage
  intent?: SarahIntent | null
  personId?: number | null
  pageUrl?: string | null
}): Promise<{ data: { id: number | null } | null; error: string | null }> {
  try {
    const logged = await insertSarahFunnelEvent(input)
    return { data: { id: logged.id }, error: logged.error }
  } catch (err) {
    console.error('[recordSarahFunnelStage]', err)
    return { data: null, error: 'Could not save funnel' }
  }
}
