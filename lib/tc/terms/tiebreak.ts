/**
 * The third read. Pure. (Matt 2026-09-24, asked what happens when the two
 * readers read a term differently: "Third read breaks the tie.")
 *
 * When Claude (on the PDF) and Grok (on our renders) read a term on the same
 * form differently, a third read settles it: Claude again, on a different
 * input (our page renders, only the pages in question, one form at a time),
 * asked for that form's terms without being shown either earlier answer. Two
 * of three decide:
 *   - the third agrees with the first or the second: that reading stands,
 *     with its page and quote;
 *   - one reader found nothing and the third finds nothing: the term is not
 *     on the form;
 *   - otherwise it stays unsettled, with all three readings, for Matt
 *     (lib/data/tc/deal-terms.ts puts it in his review queue).
 * The form's kind and its buyers are not voted on: a person looks at those.
 */
import { AGREED_TERM_KEYS, looseSame, type Disagreement } from './agree'
import type { TermsForm } from './read'
import type { Term, TermsDocumentReading, TermsReading } from './schema'

export const TIEBREAK_VERSION = 'tiebreak-v1-2026-09-24'

const LOOSE = new Set(['closingText', 'possession', 'escrowCompany'])
const TERM_FIELDS = new Set<string>([...AGREED_TERM_KEYS, ...LOOSE])
/** Fields a third read can settle. */
export const TIEBREAK_FIELDS = new Set<string>([...TERM_FIELDS, 'lastSignatureDate'])

/** Pages the third read looks at for one form, at most. */
export const MAX_TIEBREAK_PAGES = 8

export type Dispute = { instrument: number; title: string; kind: TermsForm['kind']; fields: string[]; pages: number[] }

export type Settlement = {
  instrument: number
  field: string
  /** Which earlier reading the third agreed with; 'absent' = not on the form. */
  agreedWith: 'first' | 'second' | 'absent'
  value: unknown
  third: unknown
}

export type UnsettledDisagreement = Disagreement & { third?: unknown }

export type TiebreakResult = {
  agreed: TermsReading[]
  disagreements: UnsettledDisagreement[]
  settled: Settlement[]
}

/** Disagreements a third read can settle, grouped by form, with the pages to read. */
export function disputesToSettle(disagreements: readonly Disagreement[], forms: readonly TermsForm[]): Dispute[] {
  const byInstrument = new Map<number, Dispute>()
  for (const d of disagreements) {
    if (!TIEBREAK_FIELDS.has(d.field)) continue
    const form = forms[d.instrument]
    if (!form) continue
    const dispute = byInstrument.get(d.instrument) ?? { instrument: d.instrument, title: form.title, kind: form.kind, fields: [], pages: [] }
    if (!dispute.fields.includes(d.field)) dispute.fields.push(d.field)
    if (d.page != null && !dispute.pages.includes(d.page)) dispute.pages.push(d.page)
    byInstrument.set(d.instrument, dispute)
  }
  return [...byInstrument.values()].map((x) => {
    // A signature date sits on the signature page, which the term's own page
    // may not be: a dispute on it reads the whole form.
    const pages = x.fields.includes('lastSignatureDate') || !x.pages.length ? forms[x.instrument].pages : x.pages
    return { ...x, pages: [...pages].sort((a, b) => a - b).slice(0, MAX_TIEBREAK_PAGES) }
  })
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function same(field: string, a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005
  if (typeof a === 'string' && typeof b === 'string') return LOOSE.has(field) ? looseSame(a, b) : norm(a) === norm(b)
  return a === b
}

function valueOf(r: TermsReading | undefined, field: string): unknown {
  if (!r) return null
  const v = (r as Record<string, unknown>)[field]
  if (field === 'lastSignatureDate') return v ?? null
  return v && typeof v === 'object' && 'value' in (v as object) ? (v as Term<unknown>).value : null
}

/**
 * Fold the third readings (by instrument position) into an agreed reading.
 * `first` and `second` are the two original readings, so a settled term
 * keeps the page and quote of the reading it agreed with.
 */
export function settleWithThird(
  stored: { agreed: TermsReading[]; form_indexes: number[]; disagreements: readonly Disagreement[] },
  first: TermsDocumentReading,
  second: TermsDocumentReading,
  third: ReadonlyMap<number, TermsReading | null>,
): TiebreakResult {
  const agreed = stored.agreed.map((r) => ({ ...r }))
  const disagreements: UnsettledDisagreement[] = []
  const settled: Settlement[] = []
  for (const d of stored.disagreements) {
    const t = third.get(d.instrument)
    const k = stored.form_indexes.indexOf(d.instrument)
    if (!TIEBREAK_FIELDS.has(d.field) || t === undefined || k < 0) {
      disagreements.push(d)
      continue
    }
    if (t === null) {
      disagreements.push(d) // the third read failed: nothing is settled
      continue
    }
    const c = valueOf(t, d.field)
    const a = valueOf(first.instruments[d.instrument], d.field)
    const b = valueOf(second.instruments[d.instrument], d.field)
    let agreedWith: Settlement['agreedWith'] | null = null
    if (a != null && same(d.field, c, a)) agreedWith = 'first'
    else if (b != null && same(d.field, c, b)) agreedWith = 'second'
    else if (c == null && (a == null || b == null)) agreedWith = 'absent'
    if (!agreedWith) {
      disagreements.push({ ...d, third: c })
      continue
    }
    const out = agreed[k] as Record<string, unknown>
    if (agreedWith === 'absent') {
      out[d.field] = null
    } else {
      const src = (agreedWith === 'first' ? first : second).instruments[d.instrument] as Record<string, unknown>
      out[d.field] = src[d.field] ?? null
    }
    settled.push({ instrument: d.instrument, field: d.field, agreedWith, value: agreedWith === 'absent' ? null : agreedWith === 'first' ? a : b, third: c })
  }
  return { agreed, disagreements, settled }
}

/** Does this stored reading have a disagreement a third read could settle? */
export function needsTiebreak(disagreements: readonly Disagreement[] | null | undefined): boolean {
  return (disagreements ?? []).some((d) => TIEBREAK_FIELDS.has(d.field))
}

