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
  /** The county on the first document, as the section's footnote names it. */
  county: string
  hasRecorded: boolean
  hasAssociation: boolean
  publisher: string | null
  /** The recording index to credit, when a document carries one. */
  attribution: { url: string; label: string } | null
}

export function summarizePlaceDocuments(documents: readonly PlaceDocument[]): PlaceDocumentSummary | null {
  const first = documents[0]
  if (!first) return null
  const cited = documents.find((d) => d.sourceIndexUrl)
  return {
    count: documents.length,
    declarations: documents.filter((d) => d.kind === 'ccr').length,
    amendments: documents.filter((d) => d.kind === 'amendment').length,
    county: first.county,
    hasRecorded: documents.some((d) => d.recordingType !== 'association-published'),
    hasAssociation: documents.some((d) => d.recordingType === 'association-published'),
    publisher: documents.find((d) => d.publisher)?.publisher ?? null,
    attribution: cited ? { url: cited.sourceIndexUrl, label: cited.sourceLabel } : null,
  }
}
