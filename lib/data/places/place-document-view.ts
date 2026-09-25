/**
 * Pure presentational types + labels for place documents.
 *
 * Kept free of Supabase / next/headers so v3 barrel consumers (including
 * client islands that import other primitives from the barrel) do not pull
 * the DAL client into a client module graph under webpack.
 */

export type PlaceDocumentKind =
  | 'ccr'
  | 'amendment'
  | 'bylaws'
  | 'articles'
  | 'design_guidelines'
  | 'rules'

export interface PlaceDocument {
  id: string
  /** What the recording index calls this subdivision — not our slug. */
  publishedName: string
  kind: PlaceDocumentKind
  /** Verbatim recording reference: '346-1105' (book-page) or '2007-36361'. */
  recordingRef: string
  recordingType: 'book-page' | 'year-instrument' | 'unparsed' | 'association-published'
  /**
   * Set only for association-published copies. These carry no clerk's stamp, so
   * the publisher and the document's own date ARE the provenance — they stand
   * in for the instrument number a recorded copy would show.
   */
  publisher: string | null
  documentDate: string | null
  book: number | null
  page: number | null
  instrumentNumber: string | null
  recordingYear: number | null
  county: string
  /** The source's own index, for attribution. */
  sourceIndexUrl: string
  sourceLabel: string
  /** Our hosted copy. */
  url: string
  fileBytes: number
  pageCount: number | null
}

export interface RecordingFace {
  recordingType: string
  recordingRef: string
  book: number | null
  page: number | null
  instrumentNumber: string | null
  publisher: string | null
  documentDate: string | null
}

function formatDocumentDate(iso: string | null): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, dd] = m
  if (mo === '01' && dd === '01') return y!
  const month = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ][Number(mo) - 1]
  return `${month} ${Number(dd)}, ${y}`
}

export function recordingFaceText(d: RecordingFace): string {
  if (d.recordingType === 'association-published') {
    const when = formatDocumentDate(d.documentDate)
    if (d.publisher && when) return `Published by ${d.publisher} · ${when}`
    if (d.publisher) return `Published by ${d.publisher}`
    return 'Published by the association'
  }
  if (d.recordingType === 'book-page' && d.book != null && d.page != null) {
    return `Book ${d.book}, Page ${d.page}`
  }
  if (d.recordingType === 'year-instrument' && d.instrumentNumber) {
    return `Instrument ${d.instrumentNumber}`
  }
  return d.recordingRef
}

export function recordingLabel(d: PlaceDocument): string {
  return recordingFaceText(d)
}

export function documentKindLabel(kind: PlaceDocumentKind): string {
  switch (kind) {
    case 'ccr':
      return 'Declaration of CC&Rs'
    case 'amendment':
      return 'Recorded amendment'
    case 'bylaws':
      return 'Bylaws'
    case 'articles':
      return 'Articles of incorporation'
    case 'design_guidelines':
      return 'Design guidelines'
    case 'rules':
      return 'Rules and regulations'
  }
}

/**
 * What a place's documents add up to, counted once for every surface that
 * describes them: V3PlaceDocuments' note and footnote, and the neighborhood
 * FAQ's CC&Rs answer (Matt 2026-09-24). One helper, so the answer can never
 * name a different count, county or attribution than the section it repeats.
 */
export interface PlaceDocumentSummary {
  count: number
  declarations: number
  amendments: number
  /** Each kind on the page with its count, the declaration first. */
  kinds: ReadonlyArray<{ kind: PlaceDocumentKind; count: number }>
  /** The county on the first document, as the section's footnote names it. */
  county: string
  hasRecorded: boolean
  hasAssociation: boolean
  /** Every document is a recorded instrument; none is an association's own copy. */
  allRecorded: boolean
  publisher: string | null
  /** The recording index to credit, when a document carries one. */
  attribution: { url: string; label: string } | null
}

/** The order the lead names the kinds in. */
const KIND_ORDER: readonly PlaceDocumentKind[] = [
  'ccr',
  'amendment',
  'bylaws',
  'articles',
  'design_guidelines',
  'rules',
]

export function summarizePlaceDocuments(documents: readonly PlaceDocument[]): PlaceDocumentSummary | null {
  const first = documents[0]
  if (!first) return null
  const cited = documents.find((d) => d.sourceIndexUrl)
  return {
    count: documents.length,
    declarations: documents.filter((d) => d.kind === 'ccr').length,
    amendments: documents.filter((d) => d.kind === 'amendment').length,
    kinds: KIND_ORDER.map((kind) => ({ kind, count: documents.filter((d) => d.kind === kind).length })).filter(
      (k) => k.count > 0,
    ),
    county: first.county,
    hasRecorded: documents.some((d) => d.recordingType !== 'association-published'),
    hasAssociation: documents.some((d) => d.recordingType === 'association-published'),
    allRecorded: documents.every((d) => d.recordingType !== 'association-published'),
    publisher: documents.find((d) => d.publisher)?.publisher ?? null,
    attribution: cited ? { url: cited.sourceIndexUrl, label: cited.sourceLabel } : null,
  }
}

function kindPhrase(kind: PlaceDocumentKind, n: number): string {
  switch (kind) {
    case 'ccr':
      return n === 1 ? 'the declaration' : `${n} declarations`
    case 'amendment':
      return n === 1 ? 'an amendment' : `${n} amendments`
    case 'bylaws':
      return n === 1 ? 'the bylaws' : `${n} sets of bylaws`
    case 'articles':
      return n === 1 ? 'the articles of incorporation' : `${n} sets of articles of incorporation`
    case 'design_guidelines':
      return n === 1 ? 'the design guidelines' : `${n} sets of design guidelines`
    case 'rules':
      return n === 1 ? 'the rules and regulations' : `${n} sets of rules and regulations`
  }
}

function joinPhrases(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * The count both surfaces open with, without its period: "4 recorded
 * documents for Mountain View: 2 declarations, an amendment, and the bylaws".
 *
 * The breakdown names every kind, so its parts add up to the count. It used to
 * name declarations and amendments only, and Mountain View's page read "4
 * recorded documents ... 2 declarations and 1 recorded amendment" with the
 * fourth, the bylaws, unnamed (found live 2026-09-25, CLAUDE.md §0). A kind
 * this list does not know drops the breakdown rather than print parts that
 * fall short of the count. "Recorded" is said only when every document is a
 * recorded instrument: an association's own copy is not one.
 */
export function placeDocumentsLead(summary: PlaceDocumentSummary, placeName: string): string {
  const { count, kinds, allRecorded } = summary
  const head = `${count} ${allRecorded ? 'recorded ' : ''}${count === 1 ? 'document' : 'documents'} for ${placeName}`
  const named = kinds.reduce((sum, k) => sum + k.count, 0)
  if (kinds.length < 2 || named !== count) return head
  return `${head}: ${joinPhrases(kinds.map((k) => kindPhrase(k.kind, k.count)))}`
}
