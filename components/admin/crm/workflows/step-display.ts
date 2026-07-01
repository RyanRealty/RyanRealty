/**
 * step-display — PURE display helpers for the workflow step builder + list.
 *
 * No React, no I/O, no server-only. Imported by the client builder island, the
 * server list page, and the Vitest suite. Keeps the "what does this step say"
 * logic in one tested place instead of duplicated across the kanban label, the
 * sequences list, and the builder card.
 *
 * The Step shape mirrors lib/crm/sequence-step-schema (the engine contract) but
 * this module only READS a step for display — it never validates or writes one.
 */

export type DisplayStep = {
  channel: string
  delayDays?: number | null
  delayMinutes?: number | null
  templateKey?: string | null
  taskName?: string | null
  addTags?: string[] | null
  removeTags?: string[] | null
  confirm?: boolean | null
  /** v2 channels carry their config in `value`. */
  value?: string | null
}

/** Human label for a channel (sentence case, no jargon). */
export function channelLabel(channel: string): string {
  switch (channel) {
    case 'email':
      return 'Email'
    case 'sms':
      return 'Text'
    case 'task':
      return 'Task'
    case 'tag':
      return 'Tags'
    case 'change_stage':
      return 'Change stage'
    case 'add_note':
      return 'Add note'
    case 'reassign':
      return 'Reassign broker'
    case 'run_automation':
      return 'Start another workflow'
    case 'stop_other_plans':
      return 'Pause other workflows'
    case 'condition':
      return 'Condition (IF/ELSE)'
    default:
      return channel
  }
}

/**
 * A short one-line summary of a step for a compact row. Uses the resolved
 * template NAME when a lookup map is provided, else the raw key. Pure.
 */
export function stepSummary(
  step: DisplayStep,
  templateNameByKey?: Record<string, string>,
): string {
  if (step.channel === 'email' || step.channel === 'sms') {
    const key = step.templateKey ?? ''
    if (!key) return `${channelLabel(step.channel)} message`
    const name = templateNameByKey?.[key]
    return `${channelLabel(step.channel)} · ${name ?? key}`
  }
  if (step.channel === 'task') {
    return `Task · ${step.taskName ?? 'Follow up'}`
  }
  if (step.channel === 'tag') {
    const parts = [
      ...(step.removeTags ?? []).map((t) => `remove ${t}`),
      ...(step.addTags ?? []).map((t) => `add ${t}`),
    ]
    return parts.length ? `Tags · ${parts.join(', ')}` : 'Tags · (none)'
  }
  if (step.channel === 'change_stage') {
    return step.value ? `Change stage → ${step.value}` : 'Change stage'
  }
  if (step.channel === 'add_note') {
    const preview = (step.value ?? '').slice(0, 40)
    return preview ? `Note · ${preview}${step.value && step.value.length > 40 ? '…' : ''}` : 'Add note'
  }
  if (step.channel === 'reassign') {
    return step.value ? `Reassign → ${step.value}` : 'Reassign broker'
  }
  if (step.channel === 'run_automation') {
    return step.value ? `Start workflow #${step.value}` : 'Start another workflow'
  }
  if (step.channel === 'stop_other_plans') {
    return 'Pause all other active workflows'
  }
  return channelLabel(step.channel)
}

/**
 * The cumulative day a step fires on, given the running total of delayDays up to
 * and including this step. Pure: returns the array of cumulative day numbers,
 * one per step, so the UI can show "Day 0", "Day 3", "Day 10" without recomputing
 * in render. A missing delay counts as 0.
 */
export function cumulativeDays(steps: ReadonlyArray<DisplayStep>): number[] {
  let total = 0
  return steps.map((s) => {
    total += Math.max(0, Math.trunc(s.delayDays ?? 0))
    return total
  })
}

/** Status label + tone for a sequence status (active | paused | archived). */
export function sequenceStatusMeta(status: string): {
  label: string
  tone: 'active' | 'paused' | 'archived'
} {
  if (status === 'active') return { label: 'Active', tone: 'active' }
  if (status === 'archived') return { label: 'Archived', tone: 'archived' }
  return { label: 'Paused', tone: 'paused' }
}
