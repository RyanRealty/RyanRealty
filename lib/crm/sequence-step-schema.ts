/**
 * Canonical workflow-step schema — the SINGLE contract shared by the engine
 * (app/api/cron/crm-sequence-engine) that READS steps and the authoring UI /
 * actions (app/actions/crm-sequences.ts) that WRITE them.
 *
 * This must stay byte-compatible with the runtime `Step` shape the engine
 * consumes. The engine reads exactly these fields:
 *   channel: 'email'|'sms'|'task'|'tag'
 *   delayDays?, delayMinutes?       (scheduling — non-negative)
 *   templateKey?                    (email/sms — resolves crm_templates by key)
 *   subject?, body?                 (inline email/sms text when no templateKey)
 *   taskName?, taskType?           (task channel)
 *   addTags?, removeTags?          (tag channel)
 *   confirm?                        (park as awaiting_broker_next instead of auto-send)
 *   fallbackEmailSubject?, fallbackEmailBody?  (sms → email fallback)
 *
 * v1 is LINEAR sequences only — no branching / conditional steps. There is no
 * "next step id" field; the engine advances by array index.
 *
 * Pure module: no I/O, no DB, no server-only. Safe to import from client,
 * server, the engine, tests, and validators. Cross-key existence checks (does
 * templateKey resolve to a live template) live in the action, not here — this
 * schema validates SHAPE only.
 */

import { z } from 'zod'

/** The four channels the engine knows how to execute. */
export const STEP_CHANNELS = ['email', 'sms', 'task', 'tag'] as const
export type StepChannel = (typeof STEP_CHANNELS)[number]

const nonNegInt = z
  .number()
  .int('must be a whole number')
  .min(0, 'cannot be negative')
  .finite()

/** A tag string is non-empty after trimming. */
const tag = z.string().trim().min(1, 'tag cannot be empty')

/**
 * The canonical step schema. Permissive on the optional payload fields (any
 * channel MAY carry a delay), strict on the channel-required fields enforced by
 * the per-channel refinements below. `passthrough()` is deliberately NOT used —
 * unknown keys are stripped so a malformed builder payload can never smuggle an
 * extra field into the engine.
 */
const baseStep = z.object({
  channel: z.enum(STEP_CHANNELS),
  delayDays: nonNegInt.optional(),
  delayMinutes: nonNegInt.optional(),
  templateKey: z.string().trim().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  taskName: z.string().trim().min(1).optional(),
  taskType: z.string().trim().min(1).optional(),
  addTags: z.array(tag).optional(),
  removeTags: z.array(tag).optional(),
  confirm: z.boolean().optional(),
  fallbackEmailSubject: z.string().optional(),
  fallbackEmailBody: z.string().optional(),
})

/**
 * Per-channel content requirements. The engine STOPS an enrollment when a
 * message step has no resolvable body and a tag step changes nothing — so the
 * schema refuses those shapes up front rather than letting the engine dead-end
 * a live contact.
 *
 *  - email / sms: must have a templateKey OR inline body (the engine resolves
 *    one of them; an empty step stops the enrollment).
 *  - task: must have a taskName (defaulted by the engine, but the authoring
 *    contract requires the author to name the task).
 *  - tag: must add or remove at least one tag (a no-op tag step is malformed).
 */
export const StepSchema = baseStep.superRefine((step, ctx) => {
  if (step.channel === 'email' || step.channel === 'sms') {
    const hasTemplate = !!step.templateKey
    const hasBody = !!(step.body && step.body.trim())
    if (!hasTemplate && !hasBody) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${step.channel} step needs a template or message body`,
        path: ['body'],
      })
    }
  }
  if (step.channel === 'task') {
    if (!step.taskName || !step.taskName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'task step needs a task name',
        path: ['taskName'],
      })
    }
  }
  if (step.channel === 'tag') {
    const adds = step.addTags?.length ?? 0
    const removes = step.removeTags?.length ?? 0
    if (adds + removes === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tag step must add or remove at least one tag',
        path: ['addTags'],
      })
    }
  }
})

/** The validated, engine-compatible step type. */
export type Step = z.infer<typeof StepSchema>

/** The full ordered list of steps for a sequence. */
export const StepsSchema = z.array(StepSchema)

/**
 * parseSteps — validate an unknown value as an ordered Step[]. THROWS on any
 * malformed step (wrong channel, negative delay, empty message, no-op tag).
 * Use this at the write boundary: the steps jsonb is only ever written through
 * a value that survived parseSteps.
 */
export function parseSteps(value: unknown): Step[] {
  return StepsSchema.parse(value)
}

/**
 * validateStep — non-throwing single-step validator. Returns the parsed step or
 * a flat list of human-readable error strings. Handy for per-row form feedback
 * in the builder without try/catch.
 */
export function validateStep(
  value: unknown,
): { ok: true; step: Step } | { ok: false; errors: string[] } {
  const result = StepSchema.safeParse(value)
  if (result.success) return { ok: true, step: result.data }
  return {
    ok: false,
    errors: result.error.issues.map((i) =>
      i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message,
    ),
  }
}

/**
 * EMPTY_STEP — a fresh, valid-by-construction starter step per channel for the
 * builder's "add step" action. A new email/sms step carries an inline body
 * placeholder so it satisfies the schema until the author picks a template; the
 * task step carries a default name; the tag step seeds one empty add slot the
 * UI fills (note: a tag step with no tags fails validateStep — the UI must
 * collect at least one tag before save, which is the intended guard).
 */
export const EMPTY_STEP: Record<StepChannel, Step> = {
  email: { channel: 'email', delayDays: 0, body: 'Write your message here.' },
  sms: { channel: 'sms', delayDays: 0, body: 'Write your text here.' },
  task: { channel: 'task', delayDays: 0, taskName: 'Follow up' },
  tag: { channel: 'tag', delayDays: 0, addTags: [] },
}
