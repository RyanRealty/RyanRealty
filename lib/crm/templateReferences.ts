/**
 * templateReferences — the pure delete-guard for CRM templates.
 *
 * A template is referenced by a sequence step via step.templateKey (matching
 * crm_templates.key — see the sequence engine at
 * app/api/cron/crm-sequence-engine/route.ts and app/actions/crm.ts buildStep).
 * Deleting a template that a live sequence still points at would leave that step
 * unable to resolve a subject/body at send time. So deleteTemplateAction must
 * refuse when any sequence references the key.
 *
 * This module is the pure decision layer: given a key and the sequences' step
 * arrays, it finds which sequences reference the key. The action does the DB I/O
 * (load sequences, call this, refuse or delete). Pure -> unit-tested without a DB.
 */

/** The minimal shape of a sequence step we care about for reference checks. */
export type SequenceStepRef = { templateKey?: string | null } & Record<string, unknown>

/** The minimal shape of a sequence row we inspect. */
export type SequenceRef = {
  id: number | string
  name: string
  steps: unknown
}

/** A normalized hit: which sequence references the template, and how many steps. */
export type TemplateReferenceHit = {
  sequenceId: number | string
  sequenceName: string
  stepCount: number
}

/**
 * Coerce a sequence's `steps` jsonb (unknown at the boundary) into an array of
 * step objects. Anything non-array, or non-object entries, yield an empty/clean
 * result rather than throwing.
 */
export function normalizeSteps(steps: unknown): SequenceStepRef[] {
  if (!Array.isArray(steps)) return []
  return steps.filter(
    (s): s is SequenceStepRef => typeof s === 'object' && s !== null,
  )
}

/**
 * Count how many steps in one sequence reference the given template key.
 * Comparison is exact (template keys are opaque identifiers, not prose).
 */
export function countStepReferences(steps: unknown, templateKey: string): number {
  if (!templateKey) return 0
  return normalizeSteps(steps).reduce((n, step) => {
    const k = step.templateKey
    return n + (typeof k === 'string' && k === templateKey ? 1 : 0)
  }, 0)
}

/**
 * Find every sequence that references the template key. Returns one hit per
 * referencing sequence (with the count of steps inside it). Empty array means
 * the template is unreferenced and safe to delete.
 */
export function findTemplateReferences(
  templateKey: string,
  sequences: SequenceRef[],
): TemplateReferenceHit[] {
  if (!templateKey) return []
  const hits: TemplateReferenceHit[] = []
  for (const seq of sequences) {
    const stepCount = countStepReferences(seq.steps, templateKey)
    if (stepCount > 0) {
      hits.push({ sequenceId: seq.id, sequenceName: seq.name, stepCount })
    }
  }
  return hits
}

export type DeleteGuardResult = { ok: true } | { ok: false; error: string }

/**
 * The delete decision. Refuses (ok:false) when any sequence references the key,
 * naming the sequences so the admin knows where to detach it first. Allows
 * (ok:true) when unreferenced.
 */
export function refuseReferencedTemplateDelete(
  templateKey: string,
  sequences: SequenceRef[],
): DeleteGuardResult {
  const hits = findTemplateReferences(templateKey, sequences)
  if (hits.length === 0) return { ok: true }
  const names = hits.map((h) => `"${h.sequenceName}"`).join(', ')
  const noun = hits.length === 1 ? 'sequence' : 'sequences'
  return {
    ok: false,
    error: `This template is used by ${hits.length} ${noun} (${names}). Remove it from those steps before deleting it.`,
  }
}

/** Valid channels for a CRM template. */
export const TEMPLATE_CHANNELS = ['email', 'sms'] as const
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number]

export type ChannelValidation =
  | { ok: true; channel: TemplateChannel }
  | { ok: false; error: string }

/**
 * Validate + normalize a channel value off the wire. Email requires a subject;
 * SMS must not carry one (SMS has no subject line). Returns the normalized
 * channel or a stable error.
 */
export function validateChannel(value: unknown): ChannelValidation {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (v === 'email' || v === 'sms') return { ok: true, channel: v }
  return { ok: false, error: 'Channel must be email or sms' }
}
