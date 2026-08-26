/**
 * getPlaceDocuments — the recorded governing documents we host for one place.
 *
 * PLACE_CONTENT_RULES R7 governs this read. Oregon's recording statute
 * (ORS 205.160) indexes only party name, document type, date and instrument
 * number: there is no subdivision field, and nothing marks a declaration as
 * current or superseded. So two things are true at once — we can show a buyer
 * the actual recorded instrument, and we cannot claim it is the complete chain.
 *
 * The read enforces the honest half mechanically:
 *   - only `status = 'published'` links are returned, and the anon RLS policy
 *     says the same thing, so an unreviewed heuristic match is unreadable
 *     rather than merely unrendered;
 *   - every row carries its recording reference and county, because R7 requires
 *     provenance on the face of the document, not in a tooltip;
 *   - completeness of the chain is never asserted. The component renders the
 *     standing caveat that later amendments may exist.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export const PLACE_DOCUMENTS_BUCKET = 'place-documents'

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

type LinkRow = {
  match_method?: string | null
  geo_slug?: string | null
  place_document?: {
    id?: string | null
    source?: string | null
    published_name?: string | null
    doc_kind?: string | null
    recording_ref?: string | null
    recording_type?: string | null
    book?: number | null
    page?: number | null
    instrument_number?: string | null
    recording_year?: number | null
    publisher?: string | null
    document_date?: string | null
    county?: string | null
    storage_path?: string | null
    file_bytes?: number | string | null
    page_count?: number | null
  } | null
}

/**
 * The only kinds that may appear under "governing documents". The database
 * trigger enforces the same set — this is the read-side half of one rule, not a
 * second opinion. Deeds, easements, liens and trust deeds live in the same
 * source bucket and are never governing documents.
 */
export const PUBLISHABLE_KINDS: readonly PlaceDocumentKind[] = [
  'ccr',
  'amendment',
  'bylaws',
  'articles',
  'design_guidelines',
  'rules',
]

/** Declarations lead; the rest follow in the order a reader wants them. */
const KIND_ORDER: readonly PlaceDocumentKind[] = [
  'ccr',
  'amendment',
  'bylaws',
  'articles',
  'design_guidelines',
  'rules',
]

/** Where each source publishes its index, and what to call it in attribution. */
const SOURCE_ATTRIBUTION: Record<string, { url: string; label: string }> = {
  deschutes_county_title: {
    url: 'https://deschutescountytitle.com/ccrs',
    label: 'Deschutes County Title',
  },
  caldera_springs_hoa: {
    url: 'https://calderasprings.com/owners-association/',
    label: "Caldera Springs Owners' Association",
  },
}

/**
 * Sort key within a kind: oldest first, so an amendment list reads as a chain.
 * Book-page recordings all predate the year-instrument era, so they sort ahead
 * of it wholesale rather than by comparing a book number to a year.
 */
function recordingOrder(d: PlaceDocument): number {
  if (d.recordingType === 'book-page' && d.book != null) return d.book * 100_000 + (d.page ?? 0)
  if (d.recordingType === 'year-instrument' && d.recordingYear != null) {
    return 10_000_000 + d.recordingYear * 100_000
  }
  return Number.MAX_SAFE_INTEGER
}

export function sortPlaceDocuments(docs: PlaceDocument[]): PlaceDocument[] {
  return [...docs].sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind)
    const kb = KIND_ORDER.indexOf(b.kind)
    if (ka !== kb) return ka - kb
    return recordingOrder(a) - recordingOrder(b)
  })
}

/**
 * The R7 face text — how this document identifies itself.
 *
 * Recorded copies say "Book 346, Page 1105" or "Instrument 2007-36361". An
 * association-published copy has no clerk's stamp and therefore no instrument
 * number, so it says who published it and what date the document carries.
 * Different provenance, stated as what it actually is rather than dressed up as
 * a recording.
 */
export function recordingLabel(d: PlaceDocument): string {
  return recordingFaceText(d)
}

/**
 * The same rule, over the raw fields rather than a rendered PlaceDocument, so
 * the admin review queue prints the identical face text a published page would.
 * One definition: a reviewer who approves "Published by Caldera Springs Owners'
 * Association · February 4, 2026" has read the line the buyer will read.
 */
export interface RecordingFace {
  recordingType: string
  recordingRef: string
  book: number | null
  page: number | null
  instrumentNumber: string | null
  publisher: string | null
  documentDate: string | null
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

function formatDocumentDate(iso: string | null): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, dd] = m
  // A bare "2026-01-01" on an association PDF usually means "the 2026 edition",
  // not the first of January, so a January-1 date renders as the year alone.
  if (mo === '01' && dd === '01') return y
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(mo) - 1]
  return `${month} ${Number(dd)}, ${y}`
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

/** Every column the renderer needs, in the shape both reads select. */
const LINK_SELECT =
  'match_method, place_document!inner(id, source, published_name, doc_kind, recording_ref, recording_type, book, page, instrument_number, recording_year, publisher, document_date, county, storage_path, file_bytes, page_count)'

/**
 * Link rows -> renderable documents, deduplicated by instrument.
 *
 * The dedupe is load-bearing for the by-label read: one recorded declaration is
 * routinely linked to several plats, and where a label is shared by more than
 * one plat (the county files three separate plats as "Bend") the same
 * instrument comes back once per plat. A buyer must see one document, not three
 * copies of it.
 */
function mapLinkRows(rows: LinkRow[], base: string): PlaceDocument[] {
  const byId = new Map<string, PlaceDocument>()
  for (const row of rows) {
    const d = row.place_document
    if (!d?.id || !d.storage_path || !d.recording_ref) continue
    if (byId.has(d.id)) continue
    const kind = d.doc_kind as PlaceDocumentKind
    if (!PUBLISHABLE_KINDS.includes(kind)) continue
    const recordingType =
      d.recording_type === 'book-page' ||
      d.recording_type === 'year-instrument' ||
      d.recording_type === 'association-published'
        ? d.recording_type
        : 'unparsed'
    const attribution = SOURCE_ATTRIBUTION[d.source ?? '']
    byId.set(d.id, {
      id: d.id,
      publishedName: (d.published_name ?? '').trim(),
      kind,
      recordingRef: d.recording_ref,
      recordingType,
      book: d.book ?? null,
      page: d.page ?? null,
      instrumentNumber: d.instrument_number ?? null,
      recordingYear: d.recording_year ?? null,
      publisher: (d.publisher ?? '').trim() || null,
      documentDate: d.document_date ?? null,
      county: (d.county ?? 'Deschutes').trim(),
      sourceIndexUrl: attribution?.url ?? '',
      sourceLabel: attribution?.label ?? '',
      url: `${base}/storage/v1/object/public/${PLACE_DOCUMENTS_BUCKET}/${d.storage_path}`,
      fileBytes: Number(d.file_bytes ?? 0),
      pageCount: d.page_count ?? null,
    })
  }
  return sortPlaceDocuments([...byId.values()])
}

async function fetchPlaceDocuments(geoType: string, geoSlug: string): Promise<PlaceDocument[]> {
  const slug = geoSlug.trim()
  const type = geoType.trim()
  if (!slug || !type) return []

  const supabase = supabaseAnon()
  if (!supabase) return []

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return []

  const { data, error } = await supabase
    .from('place_document_link')
    .select(LINK_SELECT)
    .eq('geo_type', type)
    .eq('geo_slug', slug)
    .eq('status', 'published')

  if (error) {
    // Thrown, never swallowed: a read that discards its error renders a hard
    // failure as a confident "this place has no CC&Rs on file", which is the
    // exact false-absence D13 and R3 exist to prevent.
    throw new Error(`place_document_link read failed for ${type}/${slug}: ${error.message}`)
  }

  return mapLinkRows((data ?? []) as LinkRow[], base)
}

/** The documents for a plat, plus the plat slug they were found under. */
export interface PlatDocumentSet {
  geoSlug: string
  documents: PlaceDocument[]
}

/**
 * PostgREST relays the Postgres SQLSTATE. 42703 is undefined_column, which for
 * this read means one thing only: `place_document_link.geo_label` has not been
 * added yet. That is "ask the other way", not a failure — the caller falls back
 * to the slug path — so it is the ONE error this read is allowed to absorb.
 */
const UNDEFINED_COLUMN = '42703'

/**
 * Documents for a plat matched by its LABEL rather than its slug.
 *
 * `listings.boundary_subdivision` carries `boundaries.geo_label` verbatim, so
 * this compares the string the listing holds against the string the link row
 * holds — no derivation in between. See getPlaceDocumentsForListing for why the
 * derivation it replaces was wrong on 202 of 3,218 plats.
 *
 * Returns null when nothing matches, so the caller can tell "no label match" from
 * "matched a plat that has no documents" and fall back accordingly.
 */
async function fetchPlaceDocumentsByLabel(
  geoType: string,
  geoLabel: string,
): Promise<PlatDocumentSet | null> {
  const label = geoLabel.trim()
  const type = geoType.trim()
  if (!label || !type) return null

  const supabase = supabaseAnon()
  if (!supabase) return null

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null

  const { data, error } = await supabase
    .from('place_document_link')
    .select(`geo_slug, ${LINK_SELECT}`)
    .eq('geo_type', type)
    .eq('geo_label', label)
    .eq('status', 'published')

  if (error) {
    if (error.code === UNDEFINED_COLUMN) return null
    throw new Error(`place_document_link label read failed for ${type}/${label}: ${error.message}`)
  }

  const rows = (data ?? []) as LinkRow[]
  const documents = mapLinkRows(rows, base)
  if (documents.length === 0) return null

  // One label can name more than one recorded plat. The documents are the union
  // (deduplicated above); the slug is only the "see the plat" destination, so it
  // is picked deterministically — the same label always links to the same page.
  const slugs = rows.map((r) => (r.geo_slug ?? '').trim()).filter(Boolean).sort()
  const geoSlug = slugs[0] ?? ''
  if (!geoSlug) return null

  return { geoSlug, documents }
}

/**
 * Cached 6h. Recorded instruments do not change; only our link set does, and a
 * review action revalidates the market tag.
 */
export const getPlaceDocuments = makeResilientCached(
  fetchPlaceDocuments,
  ['place-documents-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market] },
  [],
)

/** Cached 6h, same as the slug read — the same rows under a different key. */
export const getPlaceDocumentsByPlatLabel = makeResilientCached(
  fetchPlaceDocumentsByLabel,
  ['place-documents-by-label-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market] },
  null as PlatDocumentSet | null,
)
