/**
 * Two readers, one answer. Pure. (Matt 2026-09-24: "It must be bulletproof
 * that the PDFs are just being read and everything is known.")
 *
 * No single model reads every page right every time, so every contract form
 * is read twice, by two unrelated models on two different inputs: Claude on
 * the PDF itself (its text and its page images), Grok on our own page
 * renders. A term counts only when both read the same value. A term they
 * read differently, or that only one of them found, is not guessed at: it is
 * dropped from the agreed reading and listed for a person, with both readings
 * and the page.
 */
import type { Term, TermsDocumentReading, TermsReading } from './schema'

export const AGREED_TERM_KEYS = [
  'purchasePrice',
  'earnestMoney',
  'closingDate',
  'inspectionDays',
  'financingDays',
  'financingType',
  'sellerConcessions',
  'escrowNumber',
  'settlementDate',
  'receivedDate',
] as const
type AgreedKey = (typeof AGREED_TERM_KEYS)[number]

/** Text terms compared loosely (company names, possession wording): two readers transcribe punctuation differently. */
const LOOSE_KEYS = ['closingText', 'possession', 'escrowCompany'] as const
type LooseKey = (typeof LOOSE_KEYS)[number]

export type Disagreement = {
  instrument: number
  title: string
  field: string
  first: unknown
  second: unknown
  page: number | null
}

export type AgreedReading = {
  reading: TermsDocumentReading
  /** formIndexes[k] is the position, in the form list both readers were given, of reading.instruments[k]. */
  formIndexes: number[]
  disagreements: Disagreement[]
  /** Forms the two readers did not both return (count or kind differs): nothing from them is used. */
  unmatched: number
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005
  if (typeof a === 'string' && typeof b === 'string') return norm(a) === norm(b)
  return a === b
}

const FILLER = new Set(['and', 'the', 'company', 'co', 'inc', 'llc', 'of', 'a', 'an', 'on', 'at', 'by', 'date'])

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/&/g, ' and ').replace(/\./g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !FILLER.has(w)))
}

/**
 * Two transcriptions of the same words: most of their words shared (Jaccard
 * 0.6). "Western Title & Escrow Company" and "Western Title and Escrow" agree;
 * "Western Title" and "Bend Premier Real Estate, Ryan Realty LLC and Western
 * Title" (a hold-harmless clause read as the escrow company) do not.
 */
export function looseSame(a: string, b: string): boolean {
  const x = tokens(a)
  const y = tokens(b)
  if (!x.size || !y.size) return false
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / (x.size + y.size - shared) >= 0.6
}

function surnameSet(people: string[]): Set<string> {
  return new Set(people.map((p) => p.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).pop() ?? '').filter(Boolean))
}

/**
 * The agreed reading of one document. Forms are matched by position and must
 * be the same kind; the reader was given the same form list in the same order.
 */
export function agreeReadings(first: TermsDocumentReading, second: TermsDocumentReading): AgreedReading {
  const disagreements: Disagreement[] = []
  const instruments: TermsReading[] = []
  const formIndexes: number[] = []
  const n = Math.min(first.instruments.length, second.instruments.length)
  let unmatched = Math.abs(first.instruments.length - second.instruments.length)
  for (let i = 0; i < n; i++) {
    const a = first.instruments[i]
    const b = second.instruments[i]
    if (a.kind !== b.kind) {
      unmatched++
      disagreements.push({ instrument: i, title: a.title, field: 'kind', first: a.kind, second: b.kind, page: null })
      continue
    }
    const out: TermsReading = { ...a }
    for (const key of AGREED_TERM_KEYS) {
      const ta = a[key] as Term<unknown> | null
      const tb = b[key] as Term<unknown> | null
      if (!ta && !tb) continue
      if (ta && tb && sameValue(ta.value, tb.value)) {
        ;(out as Record<AgreedKey, unknown>)[key] = { ...ta, page: ta.page ?? tb.page, quote: ta.quote ?? tb.quote }
        continue
      }
      ;(out as Record<AgreedKey, unknown>)[key] = null
      disagreements.push({ instrument: i, title: a.title, field: key, first: ta?.value ?? null, second: tb?.value ?? null, page: ta?.page ?? tb?.page ?? null })
    }
    for (const key of LOOSE_KEYS) {
      const ta = a[key] as Term<string> | null
      const tb = b[key] as Term<string> | null
      if (!ta && !tb) continue
      if (ta && tb && looseSame(ta.value, tb.value)) continue
      ;(out as Record<LooseKey, unknown>)[key] = null
      disagreements.push({ instrument: i, title: a.title, field: key, first: ta?.value ?? null, second: tb?.value ?? null, page: ta?.page ?? tb?.page ?? null })
    }
    // The signature date decides the acceptance date and the order of the chain.
    if (a.lastSignatureDate !== b.lastSignatureDate) {
      if (a.lastSignatureDate || b.lastSignatureDate) {
        disagreements.push({ instrument: i, title: a.title, field: 'lastSignatureDate', first: a.lastSignatureDate, second: b.lastSignatureDate, page: null })
      }
      out.lastSignatureDate = null
    }
    // Who the buyers are picks the offer: agree on at least one surname, else keep nobody.
    const sa = surnameSet(a.buyers)
    const shared = b.buyers.some((p) => sa.has(surnameSet([p]).values().next().value ?? ''))
    if (!shared && (a.buyers.length || b.buyers.length)) {
      out.buyers = []
      disagreements.push({ instrument: i, title: a.title, field: 'buyers', first: a.buyers, second: b.buyers, page: null })
    }
    if (a.saleAgreementNumber && b.saleAgreementNumber && norm(a.saleAgreementNumber) !== norm(b.saleAgreementNumber)) out.saleAgreementNumber = null
    if ((a.instanceNumber ?? '') !== (b.instanceNumber ?? '')) out.instanceNumber = a.instanceNumber && b.instanceNumber ? null : a.instanceNumber ?? b.instanceNumber
    instruments.push(out)
    formIndexes.push(i)
  }
  return {
    reading: { instruments, unreadablePages: Array.from(new Set([...first.unreadablePages, ...second.unreadablePages])).sort((x, y) => x - y) },
    formIndexes,
    disagreements,
    unmatched,
  }
}
