/**
 * Monthly market report editions: the published archive.
 *
 * Table public.market_report_editions (one row per data month, frozen payload
 * + citations + PDF path). Storage bucket `market-reports` (public) holds the
 * PDFs; pages link to them through /housing-market/reports/monthly/<month>/pdf
 * so the download lives on our domain.
 *
 * Reads for public pages use the anon client (RLS lets anon read published
 * rows only) behind the resilient cache. Writes use the service client and are
 * called by the backfill script and the monthly cron.
 */
import { createServiceClient, supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { Citation, EditionPayload } from '@/lib/market-report/types'

export const REPORT_BUCKET = 'market-reports'

/**
 * Writes retry a gateway blip. The 2006-2026 backfill lost edition 219 of 248
 * to one Cloudflare 520 in front of Supabase on 2026-09-25; the monthly cron
 * must not lose a month to the same. Four attempts, 2, 4 and 8 s apart; a
 * refusal that is not transient (a constraint, a policy) fails on the last.
 */
async function withWriteRetry<T>(label: string, attempt: () => Promise<T>): Promise<T> {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      return await attempt()
    } catch (err) {
      last = err
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * 2 ** i))
    }
  }
  throw last instanceof Error ? last : new Error(`[${label}] ${String(last)}`)
}

export type EditionStatus = 'draft' | 'published' | 'withdrawn'

export type EditionListItem = {
  edition_month: string
  slug: string
  title: string
  summary: string | null
  pdf_path: string | null
  pdf_bytes: number | null
  page_count: number | null
  published_at: string | null
  data_complete_through: string
}

export type EditionRow = EditionListItem & {
  status: EditionStatus
  payload: EditionPayload
  citations: Citation[]
  definition_id: string
  generated_at: string
  hold_reason: string | null
}

const LIST_COLUMNS =
  'edition_month, slug, title, summary, pdf_path, pdf_bytes, page_count, published_at, data_complete_through'

/** Storage path for an edition's PDF: grouped by year. */
export function editionPdfPath(editionMonth: string): string {
  return `central-oregon/${editionMonth.slice(0, 4)}/ryan-realty-central-oregon-market-report-${editionMonth}.pdf`
}

/** Public object URL for a stored PDF (the /pdf route streams from here). */
export function editionPdfObjectUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!base) return null
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${REPORT_BUCKET}/${path}`
}

async function _listPublishedEditionsUncached(): Promise<EditionListItem[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const out: EditionListItem[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('market_report_editions')
      .select(LIST_COLUMNS)
      .eq('status', 'published')
      .order('edition_month', { ascending: false })
      .range(from, from + 999)
    if (error) throw new Error(`[listPublishedEditions] ${error.message}`)
    const rows = (data ?? []) as EditionListItem[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

export const listPublishedEditions = makeResilientCached(
  _listPublishedEditionsUncached,
  ['market-report-editions-list-v1'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.market] },
  [],
)

async function _getPublishedEditionUncached(editionMonth: string): Promise<EditionRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const month = /^\d{4}-\d{2}$/.test(editionMonth) ? `${editionMonth}-01` : editionMonth
  const { data, error } = await sb
    .from('market_report_editions')
    .select(`${LIST_COLUMNS}, status, payload, citations, definition_id, generated_at, hold_reason`)
    .eq('status', 'published')
    .eq('edition_month', month)
    .maybeSingle()
  if (error) throw new Error(`[getPublishedEdition] ${error.message}`)
  return (data as EditionRow | null) ?? null
}

export const getPublishedEdition = makeResilientCached(
  _getPublishedEditionUncached,
  ['market-report-edition-v1'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.market] },
  null,
)

/** Service read of any edition (draft included), for the cron and scripts. */
export async function getEditionForWrite(editionMonth: string): Promise<EditionRow | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_report_editions')
    .select(`${LIST_COLUMNS}, status, payload, citations, definition_id, generated_at, hold_reason`)
    .eq('edition_month', `${editionMonth.slice(0, 7)}-01`)
    .maybeSingle()
  if (error) throw new Error(`[getEditionForWrite] ${error.message}`)
  return (data as EditionRow | null) ?? null
}

async function ensureBucket(): Promise<void> {
  const sb = createServiceClient()
  const { data: buckets, error } = await sb.storage.listBuckets()
  if (error) throw new Error(`[ensureReportBucket] ${error.message}`)
  if (buckets?.some((b) => b.name === REPORT_BUCKET)) return
  const { error: createErr } = await sb.storage.createBucket(REPORT_BUCKET, {
    public: true,
    allowedMimeTypes: ['application/pdf'],
  })
  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`[ensureReportBucket] ${createErr.message}`)
  }
}

let bucketReady: Promise<void> | null = null

export async function uploadEditionPdf(editionMonth: string, pdf: Buffer): Promise<string> {
  if (!bucketReady) bucketReady = ensureBucket()
  await bucketReady
  const path = editionPdfPath(editionMonth)
  const sb = createServiceClient()
  await withWriteRetry('uploadEditionPdf', async () => {
    const { error } = await sb.storage.from(REPORT_BUCKET).upload(path, pdf, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '86400',
    })
    if (error) throw new Error(`[uploadEditionPdf ${editionMonth}] ${error.message}`)
  })
  return path
}

export type UpsertEditionInput = {
  editionMonth: string
  slug: string
  title: string
  status: EditionStatus
  payload: EditionPayload
  citations: Citation[]
  summary: string
  pdfPath: string | null
  pdfBytes: number | null
  pageCount: number | null
  dataCompleteThrough: string
  definitionId: string
  holdReason: string | null
  generatedAt: string
}

export async function upsertEdition(input: UpsertEditionInput): Promise<void> {
  const sb = createServiceClient()
  await withWriteRetry('upsertEdition', () => upsertEditionOnce(sb, input))
}

async function upsertEditionOnce(sb: ReturnType<typeof createServiceClient>, input: UpsertEditionInput): Promise<void> {
  const { error } = await sb.from('market_report_editions').upsert(
    {
      edition_month: `${input.editionMonth.slice(0, 7)}-01`,
      slug: input.slug,
      title: input.title,
      status: input.status,
      payload: input.payload,
      citations: input.citations,
      summary: input.summary,
      pdf_path: input.pdfPath,
      pdf_bytes: input.pdfBytes,
      page_count: input.pageCount,
      data_complete_through: input.dataCompleteThrough,
      definition_id: input.definitionId,
      hold_reason: input.holdReason,
      generated_at: input.generatedAt,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
    },
    { onConflict: 'edition_month' },
  )
  if (error) throw new Error(`[upsertEdition ${input.editionMonth}] ${error.message}`)
}
