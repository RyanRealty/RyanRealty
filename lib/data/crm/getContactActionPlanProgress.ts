/**
 * getContactActionPlanProgress — reads live sequence enrollments for a contact
 * paired with the sequence metadata (name, total step count). Drives the Action
 * Plans progress panel on the person-detail page (FUB §7c.8.1 / §7c.8.7).
 *
 * Only non-terminal statuses are returned. Terminal enrollments (stopped,
 * completed) are filtered out — they are visible in the activity timeline instead.
 *
 * DAL boundary (G1): raw .from() lives here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type ActionPlanEnrollment = {
  enrollmentId: number
  sequenceId: number
  sequenceName: string
  /** 0-based index of the next step to execute. */
  stepIndex: number
  /** Total steps in the plan (from crm_sequences.steps JSONB array length). */
  totalSteps: number
  /** running | paused | paused_reply | awaiting_broker | awaiting_broker_next */
  status: string
  nextRunAt: string | null
  enrolledAt: string
}

const LIVE_STATUSES = [
  'running',
  'paused',
  'paused_reply',
  'awaiting_broker',
  'awaiting_broker_next',
]

export async function getContactActionPlanProgress(
  personId: number,
): Promise<ActionPlanEnrollment[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()

  const { data: enrollments } = await sb
    .from('crm_sequence_enrollments')
    .select('id, sequence_id, step_index, status, next_run_at, created_at')
    .eq('person_id', personId)
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false })

  if (!enrollments || enrollments.length === 0) return []

  const seqIds = [...new Set(enrollments.map((e) => Number(e.sequence_id)))]
  const { data: seqs } = await sb
    .from('crm_sequences')
    .select('id, name, steps')
    .in('id', seqIds)

  const seqMeta = new Map<number, { name: string; totalSteps: number }>()
  for (const s of seqs ?? []) {
    const steps = Array.isArray(s.steps) ? s.steps : []
    seqMeta.set(Number(s.id), { name: String(s.name ?? ''), totalSteps: steps.length })
  }

  return enrollments.map((e) => {
    const seqId = Number(e.sequence_id)
    const meta = seqMeta.get(seqId)
    return {
      enrollmentId: Number(e.id),
      sequenceId: seqId,
      sequenceName: meta?.name ?? `Plan #${seqId}`,
      stepIndex: Number(e.step_index ?? 0),
      totalSteps: meta?.totalSteps ?? 0,
      status: String(e.status ?? 'running'),
      nextRunAt: typeof e.next_run_at === 'string' ? e.next_run_at : null,
      enrolledAt: String(e.created_at ?? ''),
    }
  })
}
