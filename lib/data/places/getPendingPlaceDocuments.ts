/**
 * getPendingPlaceDocuments — the review queue behind PLACE_CONTENT_RULES R7.
 *
 * A heuristic match lands in `place_document_link` as `pending_review` and
 * renders nowhere until a human says otherwise. Read from this function against
 * `dwvlophlbvvygjfxcrhm` on 2026-08-26: 5,474 pending links over 890
 * subdivision plats, filed under 353 recorded names. The ingest is still
 * running, so treat those as the shape rather than the count.
 *
 * WHY THIS READ GROUPS BY published_name. The link is what waits, but the link
 * is not what a reviewer decides. One recorded declaration chain governs every
 * phase of a plat — the Ridge at Eagle Crest entry covers 57 plats on its own —
 * so "is this really that subdivision's declaration?" is asked once and answered
 * for all of them. Grouping by the source's own published name turns 5,444 rows
 * into 353 questions, and puts the same 353 names in front of the reviewer that
 * the county index used.
 *
 * WHY THE OCR EXCERPT IS ON THE ROW. The document's own front matter is the
 * evidence — 'FIFTH AMENDMENT TO DECLARATION … (EAGLE CREST ESTATE …)' settles
 * the match without opening the PDF. It is shown to the reviewer as a quotation
 * of an internal machine read, never as page copy: the OCR migration-era misread
 * that bars it from public surfaces is exactly why a human is looking at it.
 *
 * SERVICE CLIENT, DELIBERATELY. The anon RLS policy on `place_document_link`
 * exposes `status = 'published'` and nothing else — an unreviewed guess is
 * unreadable rather than merely unrendered. The review queue is the one surface
 * that must see past that policy, so it reads through the sanctioned service
 * client and is mounted behind `requireAdminPage('content.communities')`.
 */

import { createServiceClient } from '@/lib/data/client'
import {
  PLACE_DOCUMENTS_BUCKET,
  PUBLISHABLE_KINDS,
  recordingFaceText,
  type PlaceDocumentKind,
} from '@/lib/data/places/getPlaceDocuments'

/**
  * Groups per page. 353 names is still a scroll, and the biggest ones carry a
  * dozen documents each — a full slice of 25 renders ~250 document rows. Ten is
  * a screenful of decisions, and the plat-count ordering puts the ones that
  * clear the most plats on the first pages.
  */
export const PENDING_GROUP_PAGE_SIZE = 10

/** How much of the front matter the row quotes. Enough for the title line. */
const OCR_EXCERPT_CHARS = 200

/** PostgREST reads a page at a time; keyset by id, ordered, never unordered. */
const READ_PAGE = 1000

/**
 * Chunk size for the `in.(…)` detail read. UUIDs are 36 characters, so 40 ids
 * is a ~1.5 KB query string — comfortably inside the gateway's URL limit, which
 * a single 600-id list would not be.
 */
const IN_CHUNK = 40

/**
 * Every `doc_kind` the check constraint allows, and what to call it. The
 * governing half is the same set `place_document_publishable_kind()` returns;
 * the rest are the title-plant bycatch the source bucket files alongside them.
 */
const KIND_LABELS: Record<string, string> = {
  ccr: 'Declaration of CC&Rs',
  amendment: 'Recorded amendment',
  bylaws: 'Bylaws',
  articles: 'Articles of incorporation',
  design_guidelines: 'Design guidelines',
  rules: 'Rules and regulations',
  budget: 'Association budget',
  reserve_study: 'Reserve study',
  deed: 'Deed',
  easement: 'Easement',
  lien: 'Lien',
  trust_deed: 'Trust deed',
  assignment: 'Assignment',
  contract: 'Contract',
  other: 'Unclassified instrument',
}

const GOVERNING = new Set<string>(PUBLISHABLE_KINDS as readonly string[])

/**
 * Does the database trigger allow this kind onto a place page? The trigger is
 * the authority and takes no override — a warranty deed is not a subdivision's
 * CC&Rs no matter who approves it. This is the read-side half of that one rule,
 * so the queue never offers a decision the write would refuse.
 */
export function isGoverningDocKind(kind: string): kind is PlaceDocumentKind {
  return GOVERNING.has(kind)
}

export function pendingKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Unclassified instrument'
}

export interface PendingPlaceDocument {
  id: string
  /** Verbatim recording reference: '346-1105' or '2007-36361'. */
  recordingRef: string
  /**
   * The R7 face text, produced by the SAME function the public page uses:
   * 'Book 346, Page 1105', 'Instrument 2007-36361', or — for an association's
   * own execution copy, which carries no clerk's stamp — 'Published by Caldera
   * Springs Owners' Association · February 4, 2026'. A reviewer therefore
   * approves the exact line a buyer will read.
   */
  recordingLabel: string
  kind: string
  kindLabel: string
  /** False for deeds, easements, liens — the trigger refuses to publish them. */
  governing: boolean
  /** Does the document's own text name the subdivision it is indexed under? */
  nameConfirmed: boolean | null
  pageCount: number | null
  fileBytes: number
  county: string
  /** Our hosted copy, public bucket, no signed URL. */
  url: string
  /** First ~200 characters of the OCR front matter, whitespace collapsed. */
  ocrExcerpt: string
  /**
   * Plats this document is still pending against. One link per plat — the
   * table's unique (document_id, geo_type, geo_slug) makes the two the same
   * number.
   */
  pendingLinkCount: number
}

export interface PendingPlaceDocumentGroup {
  /** What the recording index calls this subdivision — the group key. */
  publishedName: string
  geoType: string
  platSlugs: string[]
  platCount: number
  pendingLinkCount: number
  documents: PendingPlaceDocument[]
  /** Links an approve would publish — governing instruments only. */
  approvableLinkCount: number
  /** Links carrying a non-governing instrument. Reject is their only exit. */
  blockedLinkCount: number
}

export interface PendingPlaceDocumentQueue {
  groups: PendingPlaceDocumentGroup[]
  totalGroups: number
  totalPlats: number
  totalPendingLinks: number
  /** Groups holding no governing instrument at all — nothing to approve. */
  groupsWithNothingToPublish: number
  page: number
  pageCount: number
  pageSize: number
}

type LinkRow = { id: string; geo_type: string; geo_slug: string; document_id: string }
type DocIndexRow = { id: string; published_name: string; doc_kind: string }
type DocDetailRow = {
  id: string
  published_name: string
  doc_kind: string
  recording_ref: string
  recording_type: string | null
  book: number | null
  page: number | null
  instrument_number: string | null
  publisher: string | null
  document_date: string | null
  county: string | null
  storage_path: string
  file_bytes: number | string | null
  page_count: number | null
  name_confirmed: boolean | null
  ocr_text: string | null
}

/**
 * Every pending link, minimal columns, read by keyset on `id`. `range()`
 * without `order()` drops rows under concurrent writes, so the ordering is not
 * optional — it is what makes the pagination whole.
 *
 * The document join is deliberately NOT taken here: repeating a 3 KB
 * `ocr_text` once per link would move ~20 MB to build one page.
 */
async function readPendingLinks(): Promise<LinkRow[]> {
  const supabase = createServiceClient()
  const out: LinkRow[] = []
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await supabase
      .from('place_document_link')
      .select('id, geo_type, geo_slug, document_id')
      .eq('status', 'pending_review')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(READ_PAGE)
    if (error) throw new Error(`place_document_link read failed: ${error.message}`)
    const rows = (data ?? []) as LinkRow[]
    if (!rows.length) break
    out.push(...rows)
    last = rows[rows.length - 1].id
    if (rows.length < READ_PAGE) break
  }
  return out
}

/**
 * The name + kind index over documents. Three short columns over the whole
 * table (2,189 rows), so the grouping needs no id list in a query string.
 */
async function readDocumentIndex(): Promise<DocIndexRow[]> {
  const supabase = createServiceClient()
  const out: DocIndexRow[] = []
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await supabase
      .from('place_document')
      .select('id, published_name, doc_kind')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(READ_PAGE)
    if (error) throw new Error(`place_document index read failed: ${error.message}`)
    const rows = (data ?? []) as DocIndexRow[]
    if (!rows.length) break
    out.push(...rows)
    last = rows[rows.length - 1].id
    if (rows.length < READ_PAGE) break
  }
  return out
}

function recordingLabelOf(d: DocDetailRow): string {
  return recordingFaceText({
    recordingType: d.recording_type ?? 'unparsed',
    recordingRef: d.recording_ref,
    book: d.book,
    page: d.page,
    instrumentNumber: d.instrument_number,
    publisher: d.publisher,
    documentDate: d.document_date,
  })
}

function excerpt(text: string | null): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= OCR_EXCERPT_CHARS) return flat
  return `${flat.slice(0, OCR_EXCERPT_CHARS).trimEnd()}…`
}

/**
 * One page of the queue, groups ordered by plat count descending — the biggest
 * decision first, because that is the one that clears the most rows.
 *
 * Uncached by design: this is a worklist a reviewer is actively draining, and a
 * six-hour window would show them work they already did.
 */
export async function getPendingPlaceDocuments(
  opts: { page?: number; pageSize?: number } = {},
): Promise<PendingPlaceDocumentQueue> {
  const pageSize = Math.max(1, Math.trunc(opts.pageSize ?? PENDING_GROUP_PAGE_SIZE))
  const wanted = Math.max(1, Math.trunc(opts.page ?? 1))

  // 1 + 2. The two cheap reads that make the grouping possible.
  const [links, docIndex] = await Promise.all([readPendingLinks(), readDocumentIndex()])
  const indexById = new Map(docIndex.map((d) => [d.id, d]))

  // 3. Group. A link whose document vanished is dropped rather than guessed at.
  interface Bucket {
    publishedName: string
    geoType: string
    plats: Set<string>
    links: number
    approvable: number
    blocked: number
    docs: Map<string, { links: number }>
  }
  const buckets = new Map<string, Bucket>()
  const allPlats = new Set<string>()
  for (const link of links) {
    const doc = indexById.get(link.document_id)
    if (!doc) continue
    const key = doc.published_name
    let b = buckets.get(key)
    if (!b) {
      b = {
        publishedName: key,
        geoType: link.geo_type,
        plats: new Set(),
        links: 0,
        approvable: 0,
        blocked: 0,
        docs: new Map(),
      }
      buckets.set(key, b)
    }
    b.plats.add(link.geo_slug)
    b.links += 1
    if (isGoverningDocKind(doc.doc_kind)) b.approvable += 1
    else b.blocked += 1
    let d = b.docs.get(doc.id)
    if (!d) {
      d = { links: 0 }
      b.docs.set(doc.id, d)
    }
    d.links += 1
    allPlats.add(link.geo_slug)
  }

  const ordered = [...buckets.values()].sort(
    (a, b) => b.plats.size - a.plats.size || a.publishedName.localeCompare(b.publishedName),
  )
  const totalGroups = ordered.length
  const pageCount = Math.max(1, Math.ceil(totalGroups / pageSize))
  const page = Math.min(wanted, pageCount)
  const slice = ordered.slice((page - 1) * pageSize, page * pageSize)

  // 4. Full detail — ocr_text included — for the visible slice ONLY.
  const wantedDocIds = slice.flatMap((b) => [...b.docs.keys()])
  const details = new Map<string, DocDetailRow>()
  if (wantedDocIds.length) {
    const supabase = createServiceClient()
    for (let i = 0; i < wantedDocIds.length; i += IN_CHUNK) {
      const chunk = wantedDocIds.slice(i, i + IN_CHUNK)
      const { data, error } = await supabase
        .from('place_document')
        .select(
          'id, published_name, doc_kind, recording_ref, recording_type, book, page, instrument_number, publisher, document_date, county, storage_path, file_bytes, page_count, name_confirmed, ocr_text',
        )
        .in('id', chunk)
      if (error) throw new Error(`place_document detail read failed: ${error.message}`)
      for (const row of (data ?? []) as DocDetailRow[]) details.set(row.id, row)
    }
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const groups: PendingPlaceDocumentGroup[] = slice.map((b) => {
    const documents: PendingPlaceDocument[] = []
    for (const [docId, agg] of b.docs) {
      const d = details.get(docId)
      if (!d) continue
      documents.push({
        id: d.id,
        recordingRef: d.recording_ref,
        recordingLabel: recordingLabelOf(d),
        kind: d.doc_kind,
        kindLabel: pendingKindLabel(d.doc_kind),
        governing: isGoverningDocKind(d.doc_kind),
        nameConfirmed: d.name_confirmed ?? null,
        pageCount: d.page_count ?? null,
        fileBytes: Number(d.file_bytes ?? 0),
        county: (d.county ?? 'Deschutes').trim(),
        url: base ? `${base}/storage/v1/object/public/${PLACE_DOCUMENTS_BUCKET}/${d.storage_path}` : '',
        ocrExcerpt: excerpt(d.ocr_text),
        pendingLinkCount: agg.links,
      })
    }
    // Governing first, then most-linked: the row that decides the group leads.
    documents.sort(
      (x, y) =>
        Number(y.governing) - Number(x.governing) ||
        y.pendingLinkCount - x.pendingLinkCount ||
        x.recordingRef.localeCompare(y.recordingRef),
    )
    return {
      publishedName: b.publishedName,
      geoType: b.geoType,
      platSlugs: [...b.plats].sort(),
      platCount: b.plats.size,
      pendingLinkCount: b.links,
      documents,
      approvableLinkCount: b.approvable,
      blockedLinkCount: b.blocked,
    }
  })

  return {
    groups,
    totalGroups,
    totalPlats: allPlats.size,
    totalPendingLinks: links.length,
    groupsWithNothingToPublish: ordered.filter((b) => b.approvable === 0).length,
    page,
    pageCount,
    pageSize,
  }
}
