/**
 * Who fills an envelope field, what counts as filled, and whether a signer's
 * answers are complete: one set of rules for the composer, the signing page,
 * the server that accepts a signature, and the sealer. Pure.
 *
 * Matt 2026-09-24: "With the forms, they have the ability to include date and
 * time pickers, checkboxes, and determine whether they're read-only or can be
 * assigned to someone for use." His call on the broker's own values: "Locked,
 * with a per-field switch". So:
 *   - a field with no recipient is the broker's: it prints as the broker set it
 *     and no signer can change it;
 *   - the switch hands a field to a signer, keeping what the broker typed as
 *     its starting value: the field is then that signer's to change;
 *   - a signer fills only their own fields, sees other signers' finished
 *     values, and never sees anyone's unfinished ones;
 *   - the signing date, time and the signer's name are stamped by the server
 *     at submit, never taken from the browser.
 * SkySlope DigiSign's blocks (Signature, Initials, Full Name, Date, Time,
 * Checkbox, Text, Strike) and its linked-checkbox rules ("select at least /
 * exactly / at most N") are the model; the calendar and time pickers are
 * SkySlope Forms'.
 */
import { formatDate } from '@/lib/format/date'
import type { EnvelopeField, FieldGroup, SignFieldType, SignFieldValue } from './signing'

/** Types only a signer can complete: no broker ever signs for someone. */
export const SIGNER_ONLY_TYPES: ReadonlySet<SignFieldType> = new Set(['signature', 'initials', 'full_name', 'date_signed', 'time_signed'])

/** Stamped at submit (the server's clock, the recipient's own name). */
export const AUTO_STAMPED_TYPES: ReadonlySet<SignFieldType> = new Set(['full_name', 'date_signed', 'time_signed'])

/** Sender marks on the page, never values. */
export const ANNOTATION_TYPES: ReadonlySet<SignFieldType> = new Set(['strike', 'highlight'])

/** Types the broker can fill before sending (and a signer can be handed). */
export const FILLABLE_TYPES: ReadonlySet<SignFieldType> = new Set(['text', 'checkbox', 'date', 'time'])

export type FieldOwner = 'mine' | 'locked' | 'theirs'

/** Whose field this is, from the signer's side. */
export function fieldOwner(field: Pick<EnvelopeField, 'recipientId'>, recipientId: string): FieldOwner {
  if (!field.recipientId) return 'locked'
  return field.recipientId === recipientId ? 'mine' : 'theirs'
}

// ── dates and times ─────────────────────────────────────────────────────────

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** A real calendar date between 1900 and 2100, as the picker gives it (YYYY-MM-DD). */
export function isIsoDate(iso: string): boolean {
  const m = ISO_DATE.exec(iso)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1900 || y > 2100) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** 2026-11-30 → 11/30/2026, the date format on Oregon forms (and SkySlope's default). */
export function formatFieldDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ''
}

export function isHhmm(hhmm: string): boolean {
  return HHMM.test(hhmm)
}

/** 17:05 → 5:05 PM. */
export function formatFieldTime(hhmm: string): string {
  const m = HHMM.exec(hhmm)
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

export function dateValue(iso: string): SignFieldValue | null {
  return isIsoDate(iso) ? { kind: 'date', iso, text: formatFieldDate(iso) } : null
}

export function timeValue(hhmm: string): SignFieldValue | null {
  return isHhmm(hhmm) ? { kind: 'time', hhmm, text: formatFieldTime(hhmm) } : null
}

/** What a stamp reads at this moment in Oregon: 09/24/2026 and 2:05 PM. */
export function pacificStamp(now: Date): { date: string; time: string } {
  const date = formatDate(now, { month: '2-digit', day: '2-digit', year: 'numeric' })
  const time = formatDate(now, { month: undefined, day: undefined, year: undefined, hour: 'numeric', minute: '2-digit' })
  // Newer ICU puts a narrow no-break space before AM/PM; the sealed page's
  // Helvetica has no glyph for it.
  return { date, time: time.replace(/[\u202f\u00a0]/g, ' ') }
}

// ── what counts as filled ───────────────────────────────────────────────────

/** The text a value prints as, whatever its kind. */
export function valueText(value: SignFieldValue | null | undefined): string {
  if (!value) return ''
  if (value.kind === 'text' || value.kind === 'date_signed' || value.kind === 'date' || value.kind === 'time') return value.text ?? ''
  return ''
}

export function valueIsFilled(type: SignFieldType, value: SignFieldValue | null | undefined): boolean {
  if (!value) return false
  switch (type) {
    case 'signature':
    case 'initials':
      return (value.kind === 'signature' || value.kind === 'initials') && !!value.png
    case 'checkbox':
      return value.kind === 'checkbox' && value.checked
    case 'date':
      return value.kind === 'date' && isIsoDate(value.iso)
    case 'time':
      return value.kind === 'time' && isHhmm(value.hhmm)
    case 'strike':
    case 'highlight':
      return true
    default:
      return !!valueText(value).trim()
  }
}

// ── checkbox groups ─────────────────────────────────────────────────────────

export type GroupRule = { kind: 'at_least' | 'exactly' | 'at_most'; n: number }

export function groupRule(group: Pick<FieldGroup, 'min' | 'max'>): GroupRule {
  const { min, max } = group
  if (min != null && max != null && min === max) return { kind: 'exactly', n: min }
  if (max != null && (min == null || min === 0)) return { kind: 'at_most', n: max }
  return { kind: 'at_least', n: min ?? 1 }
}

export function groupFromRule(key: string, rule: GroupRule): FieldGroup {
  const n = Math.max(rule.kind === 'at_least' ? 0 : 1, Math.trunc(rule.n))
  if (rule.kind === 'exactly') return { key, min: n, max: n }
  if (rule.kind === 'at_most') return { key, min: null, max: n }
  return { key, min: n, max: null }
}

/** "Select exactly 1", as the signer reads it. */
export function groupRuleText(group: Pick<FieldGroup, 'min' | 'max'>): string {
  const r = groupRule(group)
  const what = r.n === 1 ? 'box' : 'boxes'
  return r.kind === 'exactly' ? `Select exactly ${r.n} ${what}` : r.kind === 'at_most' ? `Select up to ${r.n} ${what}` : `Select at least ${r.n} ${what}`
}

/** Whether this many ticked boxes satisfies the rule. */
export function groupSatisfied(group: Pick<FieldGroup, 'min' | 'max'>, checked: number): boolean {
  if (group.min != null && checked < group.min) return false
  if (group.max != null && checked > group.max) return false
  return true
}

// ── what a signer still owes ────────────────────────────────────────────────

export type ChecklistItem = {
  /** A field id, or `group:<key>` for a checkbox group. */
  id: string
  fieldIds: string[]
  /** The field to scroll to. */
  firstFieldId: string
  required: boolean
  done: boolean
  prompt: string
}

const PROMPT: Partial<Record<SignFieldType, string>> = {
  signature: 'Sign',
  initials: 'Initial',
  date: 'Pick a date',
  time: 'Pick a time',
  text: 'Fill in',
  checkbox: 'Check',
}

/**
 * The signer's own work, in reading order (document, page, top to bottom):
 * each field, or each checkbox group as one item. Automatic stamps are not on
 * it: the server fills them.
 */
export function signerChecklist(
  fields: readonly EnvelopeField[],
  recipientId: string,
  values: ReadonlyMap<string, SignFieldValue>,
  documentOrder: readonly string[] = [],
): ChecklistItem[] {
  const docRank = new Map(documentOrder.map((d, i) => [d, i]))
  const mine = fields
    .filter((f) => fieldOwner(f, recipientId) === 'mine' && !AUTO_STAMPED_TYPES.has(f.type) && !ANNOTATION_TYPES.has(f.type))
    .slice()
    .sort((a, b) => (docRank.get(a.documentId) ?? 999) - (docRank.get(b.documentId) ?? 999) || a.page - b.page || a.y - b.y || a.x - b.x)
  const items: ChecklistItem[] = []
  const seenGroups = new Set<string>()
  for (const f of mine) {
    if (f.type === 'checkbox' && f.group?.key) {
      const key = f.group.key
      if (seenGroups.has(key)) continue
      seenGroups.add(key)
      const members = mine.filter((m) => m.type === 'checkbox' && m.group?.key === key)
      const checked = members.filter((m) => valueIsFilled('checkbox', values.get(m.id) ?? null)).length
      const required = (f.group.min ?? 0) > 0
      items.push({
        id: `group:${key}`,
        fieldIds: members.map((m) => m.id),
        firstFieldId: members[0].id,
        required,
        done: groupSatisfied(f.group, checked) && (!required || checked > 0),
        prompt: f.label?.trim() || groupRuleText(f.group),
      })
      continue
    }
    items.push({
      id: f.id,
      fieldIds: [f.id],
      firstFieldId: f.id,
      required: f.required,
      done: valueIsFilled(f.type, values.get(f.id) ?? null),
      prompt: f.label?.trim() || PROMPT[f.type] || 'Fill in',
    })
  }
  return items
}

/** The next item the signer still owes after `afterId` (wrapping), required first. */
export function nextChecklistItem(items: readonly ChecklistItem[], afterId: string | null): ChecklistItem | null {
  const open = items.filter((i) => !i.done)
  if (!open.length) return null
  const pool = open.some((i) => i.required) ? open.filter((i) => i.required) : open
  if (!afterId) return pool[0]
  const at = items.findIndex((i) => i.id === afterId)
  return pool.find((i) => items.indexOf(i) > at) ?? pool[0]
}

// ── accepting a submission ──────────────────────────────────────────────────

/** A drawn or typed signature is a PNG data URL; 1.5 MB is far past any real one. */
const MAX_PNG_CHARS = 1_500_000
const MAX_TEXT = 5000

function cleanValue(field: EnvelopeField, raw: unknown): SignFieldValue | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  switch (field.type) {
    case 'signature':
    case 'initials': {
      const png = typeof v.png === 'string' ? v.png : ''
      if (!png.startsWith('data:image/png;base64,') || png.length > MAX_PNG_CHARS) return null
      return field.type === 'signature' ? { kind: 'signature', png } : { kind: 'initials', png }
    }
    case 'checkbox':
      return typeof v.checked === 'boolean' ? { kind: 'checkbox', checked: v.checked } : null
    case 'date':
      return typeof v.iso === 'string' ? dateValue(v.iso) : null
    case 'time':
      return typeof v.hhmm === 'string' ? timeValue(v.hhmm) : null
    case 'text': {
      const text = typeof v.text === 'string' ? v.text.slice(0, MAX_TEXT) : ''
      return { kind: 'text', text }
    }
    default:
      return null
  }
}

export type SubmissionCheck =
  | { ok: true; values: Map<string, SignFieldValue> }
  | { ok: false; error: string; fieldId?: string }

/**
 * What the server keeps from a signer's submission: only the signer's own
 * fields, each value checked against its type, the automatic stamps written
 * from the server's clock and the recipient's name, then every required field
 * and every checkbox group's rule enforced.
 */
export function checkSubmission(
  fields: readonly EnvelopeField[],
  recipient: { id: string; name: string },
  submitted: ReadonlyMap<string, unknown>,
  now: Date,
): SubmissionCheck {
  const mine = fields.filter((f) => fieldOwner(f, recipient.id) === 'mine' && !ANNOTATION_TYPES.has(f.type))
  const stamp = pacificStamp(now)
  const values = new Map<string, SignFieldValue>()
  for (const f of mine) {
    if (f.type === 'date_signed') values.set(f.id, { kind: 'date_signed', text: stamp.date })
    else if (f.type === 'time_signed') values.set(f.id, { kind: 'text', text: stamp.time })
    else if (f.type === 'full_name') values.set(f.id, { kind: 'text', text: recipient.name.trim() })
    else if (submitted.has(f.id)) {
      const clean = cleanValue(f, submitted.get(f.id))
      if (clean) values.set(f.id, clean)
      else if (submitted.get(f.id) != null) return { ok: false, error: `That ${f.label?.trim() || f.type.replace('_', ' ')} is not valid.`, fieldId: f.id }
    } else if (f.value) {
      // The broker's starting value the signer left as it was (a laid-out
      // line keeps its size).
      const clean = cleanValue(f, f.value)
      if (clean) values.set(f.id, clean.kind === 'text' && f.value.kind === 'text' ? { ...f.value, text: clean.text } : clean)
    }
  }
  const checklist = signerChecklist(mine, recipient.id, values)
  // A group names its own rule, and its upper limit binds even when it is optional.
  for (const item of checklist) {
    if (!item.id.startsWith('group:')) continue
    const f = mine.find((m) => m.id === item.firstFieldId)
    if (f?.group) {
      const checked = item.fieldIds.filter((id) => valueIsFilled('checkbox', values.get(id) ?? null)).length
      if (!groupSatisfied(f.group, checked)) return { ok: false, error: `${groupRuleText(f.group)}.`, fieldId: item.firstFieldId }
    }
  }
  const missing = checklist.find((i) => i.required && !i.done)
  if (missing) return { ok: false, error: 'Please complete every required field before finishing.', fieldId: missing.firstFieldId }
  return { ok: true, values }
}

// ── what the composer may save ──────────────────────────────────────────────

const MAX_LABEL = 120
const MAX_GROUP_KEY = 64

export type PreparedFieldInput = {
  type: SignFieldType
  recipientId: string | null
  value?: SignFieldValue | null
  label?: string | null
  group?: FieldGroup | null
}

/**
 * A placed field as the envelope stores it. A signature, initials or stamp
 * never carries a value before signing (no one signs for a signer); a fillable
 * field keeps only a value of its own kind (a date is re-checked and re-printed);
 * a group is kept only on a checkbox, with a rule the database accepts.
 */
export function preparedField(input: PreparedFieldInput): {
  value: SignFieldValue | null
  label: string | null
  group: FieldGroup | null
} {
  const label = input.label?.trim().slice(0, MAX_LABEL) || null
  return { value: preparedValue(input.type, input.value ?? null), label, group: preparedGroup(input.type, input.group ?? null) }
}

function preparedValue(type: SignFieldType, value: SignFieldValue | null): SignFieldValue | null {
  if (!value || SIGNER_ONLY_TYPES.has(type)) return null
  if (ANNOTATION_TYPES.has(type)) return value
  switch (type) {
    case 'text':
      return value.kind === 'text' ? { ...value, text: String(value.text ?? '').slice(0, MAX_TEXT) } : null
    case 'checkbox':
      return value.kind === 'checkbox' ? { kind: 'checkbox', checked: value.checked === true } : null
    case 'date':
      return value.kind === 'date' ? dateValue(value.iso) : null
    case 'time':
      return value.kind === 'time' ? timeValue(value.hhmm) : null
    default:
      return null
  }
}

function preparedGroup(type: SignFieldType, group: FieldGroup | null): FieldGroup | null {
  if (type !== 'checkbox' || !group) return null
  const key = String(group.key ?? '').trim().slice(0, MAX_GROUP_KEY)
  if (!key) return null
  const int = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null)
  const min = int(group.min)
  const max = int(group.max)
  if (min != null && min < 0) return null
  if (max != null && max < 1) return null
  if (min != null && max != null && min > max) return null
  return { key, min, max }
}

// ── a signature line's row ──────────────────────────────────────────────────

/**
 * The boxes that belong to a signature line's row: its date (and time) to the
 * right, and the print-name line just beneath it. Assigning the line to a
 * signer in the composer takes these with it, still unassigned ones only; an
 * empty text line beneath becomes the signer's Full Name, stamped at signing.
 * Same geometry as the form promotion (lined-signature-fields.ts).
 */
export function signatureRowSiblings(
  fields: ReadonlyArray<Pick<EnvelopeField, 'documentId' | 'page' | 'type' | 'x' | 'y' | 'w' | 'recipientId' | 'value'> & { key: string }>,
  sig: Pick<EnvelopeField, 'documentId' | 'page' | 'x' | 'y'>,
): Array<{ key: string; type: SignFieldType }> {
  const out: Array<{ key: string; type: SignFieldType }> = []
  const row = fields.filter((f) => f.documentId === sig.documentId && f.page === sig.page && !f.recipientId)
  for (const f of row) {
    if ((f.type === 'date_signed' || f.type === 'time_signed') && Math.abs(f.y - sig.y) < 0.02 && f.x > sig.x) out.push({ key: f.key, type: f.type })
  }
  const print = row
    .filter((f) => (f.type === 'full_name' || (f.type === 'text' && !valueText(f.value).trim() && f.w >= 0.3)) && f.y > sig.y && f.y - sig.y < 0.035 && Math.abs(f.x - sig.x) < 0.05)
    .sort((a, b) => a.y - b.y)[0]
  if (print) out.push({ key: print.key, type: 'full_name' })
  return out
}
