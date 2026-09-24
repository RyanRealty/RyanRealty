/**
 * The reader's question and the shape of its answer. Pure: the prompt, the
 * JSON schema and the normalizer. The I/O that renders pages and calls the
 * model lives in ./read-document.ts.
 *
 * The reader transcribes; it does not judge. It says what form each segment
 * is, what number it carries, who is named, which box is checked and, line by
 * line, whether a signature is on it and whose. Whether that adds up to
 * "fully executed" is decided in code (./verdict.ts) against the form library,
 * so a model can never award execution by saying so.
 */
import type { Segment } from './anatomy'

export const READER_VERSION = 'doc-reader-v2-2026-09-23'

export const SIGNATURE_PARTIES = ['buyer', 'seller', 'buyer_agent', 'seller_agent', 'escrow', 'title', 'lender', 'vendor', 'other'] as const
export type SignatureParty = (typeof SIGNATURE_PARTIES)[number]

export const SIGN_METHODS = ['esign_stamp', 'handwritten', 'typed', 'none', 'unclear'] as const
export type SignMethod = (typeof SIGN_METHODS)[number]

export const RESPONSES = ['accepted', 'countered', 'rejected', 'none_marked', 'not_on_form'] as const
export type FormResponse = (typeof RESPONSES)[number]

export type SignatureLine = {
  page: number
  /** The printed label and section, e.g. "Seller — 51. Seller's Response". */
  label: string
  section: string
  party: SignatureParty
  signed: boolean
  /** The name the signature itself shows (e-sign stamp name, or legible handwriting). */
  signedName: string | null
  /** The name typed or written in a Print / Name field beside the line. */
  printedName: string | null
  date: string | null
  method: SignMethod
  /** Signed only if an option on the form applies ("claiming exclusion", "if applicable"). */
  conditional: boolean
}

export type FormReading = {
  segment: number
  title: string
  formNumber: string | null
  /** "2" for "Addendum No. 2" / "Seller's Counteroffer No. 2". Null when the form has no number or it is blank. */
  instanceNumber: string | null
  /** Whose counteroffer this is, for counteroffers. */
  counterBy: 'buyer' | 'seller' | null
  saleAgreementNumber: string | null
  /**
   * The first words of the filled-in terms (addenda, notices, counters): what
   * tells two unnumbered addenda on one sale apart.
   */
  termsExcerpt: string | null
  propertyAddress: string | null
  buyersNamed: string[]
  sellersNamed: string[]
  /** Nothing filled in at all: a blank form. */
  blankTemplate: boolean
  watermark: string | null
  response: FormResponse
  signatureLines: SignatureLine[]
}

export type DocumentReading = {
  forms: FormReading[]
  unreadablePages: number[]
  notes: string
}

const nullableString = { type: ['string', 'null'] }

export const READING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['forms', 'unreadablePages', 'notes'],
  properties: {
    forms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'segment', 'title', 'formNumber', 'instanceNumber', 'counterBy', 'saleAgreementNumber', 'termsExcerpt', 'propertyAddress',
          'buyersNamed', 'sellersNamed', 'blankTemplate', 'watermark', 'response', 'signatureLines',
        ],
        properties: {
          segment: { type: 'integer' },
          title: { type: 'string' },
          formNumber: nullableString,
          instanceNumber: nullableString,
          counterBy: { type: ['string', 'null'], enum: ['buyer', 'seller', null] },
          saleAgreementNumber: nullableString,
          termsExcerpt: nullableString,
          propertyAddress: nullableString,
          buyersNamed: { type: 'array', items: { type: 'string' } },
          sellersNamed: { type: 'array', items: { type: 'string' } },
          blankTemplate: { type: 'boolean' },
          watermark: nullableString,
          response: { type: 'string', enum: [...RESPONSES] },
          signatureLines: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['page', 'label', 'section', 'party', 'signed', 'signedName', 'printedName', 'date', 'method', 'conditional'],
              properties: {
                page: { type: 'integer' },
                label: { type: 'string' },
                section: { type: 'string' },
                party: { type: 'string', enum: [...SIGNATURE_PARTIES] },
                signed: { type: 'boolean' },
                signedName: nullableString,
                printedName: nullableString,
                date: nullableString,
                method: { type: 'string', enum: [...SIGN_METHODS] },
                conditional: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    unreadablePages: { type: 'array', items: { type: 'integer' } },
    notes: { type: 'string' },
  },
}

export const READER_SYSTEM = [
  'You read Oregon residential real estate transaction documents for a principal broker\'s compliance file.',
  'You transcribe what is on the page. You never infer a signature that is not visibly there, and you never assume a blank line was signed elsewhere.',
  'A signature is: a handwritten mark on the line, an electronic signature stamp (DocuSign "DocuSigned by", SkySlope "DigiSign Verified", dotloop, Authentisign), or a typed "/s/ Name". Initials in a page footer are not a signature line.',
  'A printed name in a Print or Name field is not a signature. A date alone is not a signature. An empty line with only the label is unsigned.',
  'Report every signature line you see on the pages shown, including blank ones, in page order.',
].join(' ')

export type PassPage = { page: number; segment: number }

/**
 * The per-pass instruction. Names each segment's evidence from the text layer
 * so the reader knows which pages belong together and which were left out.
 */
export function readerInstruction(input: {
  segments: readonly Segment[]
  pages: readonly PassPage[]
  pageCount: number
}): string {
  const shownBySegment = new Map<number, number[]>()
  for (const p of input.pages) shownBySegment.set(p.segment, [...(shownBySegment.get(p.segment) ?? []), p.page])
  const lines: string[] = []
  lines.push(`This PDF has ${input.pageCount} pages. You are shown ${input.pages.length} of them, grouped into the forms (segments) below.`)
  for (const seg of input.segments) {
    const shown = shownBySegment.get(seg.id)
    if (!shown?.length) continue
    const range = `pages ${seg.pages[0]}-${seg.pages[seg.pages.length - 1]}`
    const stamp = seg.oref ? `footer stamp OREF ${seg.oref}${seg.released ? ` (released ${seg.released})` : ''}` : 'no OREF footer stamp'
    lines.push(`Segment ${seg.id}: ${range}, ${stamp}; shown: ${shown.join(', ')}. Pages not shown carry contract terms without signature lines.`)
  }
  lines.push(
    '',
    'Return one entry in "forms" per segment shown. If one segment clearly holds two different forms, return one entry for each with the same segment number.',
    'title: the form title as printed. formNumber: the OREF or publisher form number as printed, else null.',
    'instanceNumber: the number filled in after "Addendum No." / "Counteroffer No." / "Notice No.", else null. counterBy: "seller" for a Seller\'s Counteroffer, "buyer" for a Buyer\'s Counteroffer, else null.',
    'saleAgreementNumber: the "Sale Agreement #" value if filled in. termsExcerpt: on an addendum, counteroffer or notice, the first 15 words of the filled-in terms exactly as written, else null. buyersNamed / sellersNamed: the buyers and sellers named on the form (the parties section, Print fields), not agents; one entry per signer, so a trust or company and the person signing for it ("Jane Doe, Trustee of the Doe Trust") are ONE entry; full names only, never initials.',
    'blankTemplate: true only when no party names, property, prices or signatures are filled in at all. watermark: DRAFT / VOID / SAMPLE text across the page, else null.',
    'response: on a sale agreement, which Seller\'s Response box is checked (accepted = "Agreement to Sell", countered, rejected), "none_marked" if the section is shown and no box is checked; on a counteroffer, "accepted" when the acceptance section is signed; "rejected" on any form marked REJECTED or VOID by a party; otherwise "not_on_form".',
    'signatureLines: every line meant for a full signature on the pages shown. Leave out initials boxes (page-footer "Buyer Initials" / "Seller Initials") and name-only fields such as "Buyer\'s Agent: <name>" that have no signature line. label: the printed label. section: the heading of the section the line sits in (for example "Final Agency Acknowledgment", "50. Offer to Purchase", "51. Seller\'s Response", "Acceptance"). party: whose line it is from the label. signed: is there a signature on the line. signedName: the name in the stamp or legible signature, else null. printedName: the Print field value, else null. date: the date written or stamped beside it, as shown. method: how it was signed, "none" when unsigned. conditional: true when the line is signed only if an option on the form applies (for example "signatures of sellers claiming exclusion", "if applicable", an alternate section), else false. A line labelled "Client" keeps party "other".',
    'unreadablePages: pages you could not read (blank render, illegible scan). notes: one or two sentences on anything a broker must know (a crossed-out term, a note that the form is void).',
  )
  return lines.join('\n')
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/**
 * Coerce the model's JSON into a DocumentReading. A signature line claiming
 * signed with method "none" is not signed; a line with no page shown to the
 * reader is dropped (it described a page it never saw).
 */
export function normalizeReading(raw: unknown, shownPages: ReadonlySet<number>): DocumentReading {
  const r = (raw ?? {}) as Record<string, unknown>
  const forms: FormReading[] = []
  for (const f of Array.isArray(r.forms) ? r.forms : []) {
    const o = (f ?? {}) as Record<string, unknown>
    const lines: SignatureLine[] = []
    for (const l of Array.isArray(o.signatureLines) ? o.signatureLines : []) {
      const x = (l ?? {}) as Record<string, unknown>
      const page = Number(x.page)
      if (!Number.isInteger(page) || !shownPages.has(page)) continue
      // Footer initials are not execution; the instruction says so and the
      // model still reports them now and then.
      if (/\binitials?\b/i.test(String(x.label ?? ''))) continue
      const method = oneOf(x.method, SIGN_METHODS, 'unclear')
      const signed = x.signed === true && method !== 'none'
      lines.push({
        page,
        label: str(x.label) ?? '',
        section: str(x.section) ?? '',
        party: oneOf(x.party, SIGNATURE_PARTIES, 'other'),
        signed,
        signedName: signed ? str(x.signedName) : null,
        printedName: str(x.printedName),
        date: str(x.date),
        method: signed ? method : 'none',
        conditional: x.conditional === true,
      })
    }
    const names = (v: unknown) => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : [])
    forms.push({
      segment: Number.isInteger(Number(o.segment)) ? Number(o.segment) : 0,
      title: str(o.title) ?? '',
      formNumber: str(o.formNumber),
      instanceNumber: str(o.instanceNumber),
      counterBy: o.counterBy === 'buyer' || o.counterBy === 'seller' ? o.counterBy : null,
      saleAgreementNumber: str(o.saleAgreementNumber),
      termsExcerpt: str(o.termsExcerpt),
      propertyAddress: str(o.propertyAddress),
      buyersNamed: names(o.buyersNamed),
      sellersNamed: names(o.sellersNamed),
      blankTemplate: o.blankTemplate === true,
      watermark: str(o.watermark),
      response: oneOf(o.response, RESPONSES, 'not_on_form'),
      signatureLines: lines,
    })
  }
  const unreadable = Array.isArray(r.unreadablePages)
    ? r.unreadablePages.map(Number).filter((n) => Number.isInteger(n) && shownPages.has(n))
    : []
  return { forms, unreadablePages: unreadable, notes: str(r.notes) ?? '' }
}
