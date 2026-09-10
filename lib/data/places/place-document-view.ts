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
