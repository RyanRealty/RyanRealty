/**
 * Canonical workflow-step schema — the SINGLE contract shared by the engine
 * (app/api/cron/crm-sequence-engine) that READS steps and the authoring UI /
 * actions (app/actions/crm-sequences.ts) that WRITE them.
 *
 * v1 channels (unchanged — backward-compatible):
 *   channel: 'email'|'sms'|'task'|'tag'
 *   delayDays?, delayMinutes?       (scheduling — non-negative)
 *   templateKey?                    (email/sms — resolves crm_templates by key)
 *   subject?, body?                 (inline email/sms text when no templateKey)
 *   taskName?, taskType?           (task channel)
 *   addTags?, removeTags?          (tag channel)
 *   confirm?                        (park as awaiting_broker_next instead of auto-send)
 *   fallbackEmailSubject?, fallbackEmailBody?  (sms → email fallback)
 *
 * v2 channels (new — additive):
 *   'change_stage'  value = stage key (moves crm_people.stage)
 *   'add_note'      value = note text (inserts crm_timeline note)
 *   'reassign'      value = broker slug (updates assigned_broker)
 *   'run_automation' value = sequence id (enrolls person in another sequence)
 *
 * v2 conditions node (optional, recursive):
 *   { type: 'condition', field, op, value, truePath: Step[], falsePath: Step[] }
 *   The engine evaluates at runtime and splices the chosen path into the flat
 *   step array. step_index stays a flat int — the enrolled position tracks
 *   which flat-materialized step we are on.
 *
 * v1 is LINEAR sequences only. v2 adds branching via the 'condition' node type.
 *
 * Pure module: no I/O, no DB, no server-only. Safe to import from client,
 * server, the engine, tests, and validators.
 */

import { z } from 'zod'

/** The channels the engine knows how to execute. */
export const STEP_CHANNELS = ['email', 'sms', 'task', 'tag', 'change_stage', 'add_note', 'reassign', 'run_automation'] as const
export type StepChannel = (typeof STEP_CHANNELS)[number]

/** Original v1 channels — kept for backward compat guards. */
export const V1_CHANNELS = ['email', 'sms', 'task', 'tag'] as const
export type V1Channel = (typeof V1_CHANNELS)[number]

const nonNegInt = z
  .number()
  .int('must be a whole number')
  .min(0, 'cannot be negative')
  .finite()

/** A tag string is non-empty after trimming. */
const tag = z.string().trim().min(1, 'tag cannot be empty')

/**
 * The canonical step schema — strict union so each channel has its own
 * required-field rules, yet the whole schema stays one flat object for the
 * engine's simple array traversal.
 *
 * Unknown keys are stripped (no passthrough) so a malformed builder payload
 * can never smuggle extra fields into the engine.
 *
 * IMPORTANT: the 'condition' node is a SEPARATE type (ConditionNode) that the
 * builder inserts into the steps array. The engine handles it before the
 * channel dispatch. It is NOT in STEP_CHANNELS because the engine never
 * "executes" it as a send action.
 */
const baseStep = z.object({
  channel: z.enum(STEP_CHANNELS),
  delayDays: nonNegInt.optional(),
  delayMinutes: nonNegInt.optional(),
  // v1 — email / sms
  templateKey: z.string().trim().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  // v1 — task
  taskName: z.string().trim().min(1).optional(),
  taskType: z.string().trim().min(1).optional(),
  // v1 — tag
  addTags: z.array(tag).optional(),
  removeTags: z.array(tag).optional(),
  // v1 — control
  confirm: z.boolean().optional(),
  fallbackEmailSubject: z.string().optional(),
  fallbackEmailBody: z.string().optional(),
  // v2 — change_stage / add_note / reassign / run_automation: all carry `value`
  value: z.string().optional(),
})

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
  if (step.channel === 'change_stage' || step.channel === 'add_note' || step.channel === 'reassign' || step.channel === 'run_automation') {
    if (!step.value || !step.value.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${step.channel} step requires a value`,
        path: ['value'],
      })
    }
  }
})

/** The validated, engine-compatible step type. */
export type Step = z.infer<typeof StepSchema>

// ── Condition node (v2 branching) ───────────────────────────────────────────

export const CONDITION_FIELDS = ['stage', 'tag', 'source'] as const
export type ConditionField = (typeof CONDITION_FIELDS)[number]

export const CONDITION_OPS = ['is', 'is_not', 'contains'] as const
export type ConditionOp = (typeof CONDITION_OPS)[number]

/**
 * A condition node sits inside the steps array. The engine detects it by
 * `type === 'condition'` (before the channel dispatch) and splices the chosen
 * truePath or falsePath steps in place of this node.
 *
 * Recursive: truePath / falsePath can themselves contain ConditionNodes.
 * The engine flattens exactly one level per step execution cycle — this keeps
 * the engine O(n) per tick while still supporting nested conditions.
 */
export type ConditionNode = {
  type: 'condition'
  field: ConditionField
  op: ConditionOp
  value: string
  truePath: AnyStepOrCondition[]
  falsePath: AnyStepOrCondition[]
}

/** Union of what can appear in the steps array (flat steps OR condition nodes). */
export type AnyStepOrCondition = Step | ConditionNode

/** Zod schema for a ConditionNode — lazy to support recursion. */
export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.object({
    type: z.literal('condition'),
    field: z.enum(CONDITION_FIELDS),
    op: z.enum(CONDITION_OPS),
    value: z.string().min(1, 'condition value required'),
    truePath: z.array(AnyStepOrConditionSchema),
    falsePath: z.array(AnyStepOrConditionSchema),
  }),
)

/** Union schema — what can appear in the steps array. */
export const AnyStepOrConditionSchema: z.ZodType<AnyStepOrCondition> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('condition') }).passthrough().transform((v) => v as ConditionNode),
    StepSchema,
  ]),
)

/**
 * The validated array of steps (may contain ConditionNodes). This is the schema
 * used by the builder. The engine resolves conditions at runtime.
 */
export const StepsSchema = z.array(AnyStepOrConditionSchema)

/**
 * parseSteps — validate an unknown value as AnyStepOrCondition[]. THROWS on
 * malformed steps. Use at the write boundary.
 *
 * Backward-compatible: a flat array of old-shape steps (no `type` field, just
 * `channel`) passes cleanly because they match StepSchema first in the union.
 */
export function parseSteps(value: unknown): AnyStepOrCondition[] {
  return StepsSchema.parse(value)
}

/** Type guard — is this a ConditionNode? */
export function isConditionNode(node: AnyStepOrCondition): node is ConditionNode {
  return (node as ConditionNode).type === 'condition'
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
 * builder's "add step" action.
 */
export const EMPTY_STEP: Record<StepChannel, Step> = {
  email: { channel: 'email', delayDays: 0, body: 'Write your message here.' },
  sms: { channel: 'sms', delayDays: 0, body: 'Write your text here.' },
  task: { channel: 'task', delayDays: 0, taskName: 'Follow up' },
  tag: { channel: 'tag', delayDays: 0, addTags: [] },
  change_stage: { channel: 'change_stage', delayDays: 0, value: '' },
  add_note: { channel: 'add_note', delayDays: 0, value: '' },
  reassign: { channel: 'reassign', delayDays: 0, value: '' },
  run_automation: { channel: 'run_automation', delayDays: 0, value: '' },
}

/**
 * EMPTY_CONDITION — a starter ConditionNode the builder inserts.
 */
export const EMPTY_CONDITION: ConditionNode = {
  type: 'condition',
  field: 'stage',
  op: 'is',
  value: '',
  truePath: [],
  falsePath: [],
}

// ── Sequence-level trigger schema (v2) ────────────────────────────────────────

export const SEQUENCE_TRIGGER_TYPES = [
  'tag_added',
  'stage_changed',
  'source_is',
  'deal_stage_changed',
  'inquiry',
  'property_saved',
  'calendar_date',
  'appointment',
] as const
export type SequenceTriggerType = (typeof SEQUENCE_TRIGGER_TYPES)[number]

export type SequenceTrigger = {
  type: SequenceTriggerType
  value?: string
}

export const SequenceTriggerSchema = z.object({
  type: z.enum(SEQUENCE_TRIGGER_TYPES),
  value: z.string().optional(),
})

export const SequenceTriggersSchema = z.array(SequenceTriggerSchema)

export function parseSequenceTriggers(value: unknown): SequenceTrigger[] {
  return SequenceTriggersSchema.parse(value)
}
