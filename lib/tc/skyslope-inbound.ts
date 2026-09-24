/**
 * SkySlope Files API inbound client — READ ONLY after session login.
 *
 * Allowed calls:
 *   POST /auth/login          (HMAC session; not a transaction-file mutation)
 *   GET  /api/files/sales
 *   GET  /api/files/listings
 *   GET  /api/files/sales/:guid
 *   GET  /api/files/listings/:guid
 *   GET  /api/files/(sales|listings)/:guid/documents
 *   GET  /api/files/(sales|listings)/:guid/documents/:docId/binary
 *   GET  the pre-signed document URL SkySlope hands out (skyslope-documents S3)
 *
 * Never PUT / PATCH / DELETE. Never POST except /auth/login.
 * Vault (`tc_*`) is the transaction SoR. This client feeds the recon mirror and
 * the daily SkySlope → Vault intake (lib/data/tc/skyslope-intake.ts), both
 * read-only against SkySlope.
 */
import { createHmac } from 'node:crypto'
import {
  brokerFromAgentGuid,
  date10,
  moneyOrNull,
  partyNames,
  type SkySlopeFolderKind,
  type SkySlopeFolderSummary,
} from './skyslope-mirror-shape'

export const SKYSLOPE_FILES_BASE = 'https://api-latest.skyslope.com'
const PAGE_SIZE = 10
const MAX_PAGES = 1000

export function hasSkySlopeInboundCreds(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.SKYSLOPE_ACCESS_KEY?.trim() &&
      env.SKYSLOPE_ACCESS_SECRET?.trim() &&
      env.SKYSLOPE_CLIENT_ID?.trim() &&
      env.SKYSLOPE_CLIENT_SECRET?.trim(),
  )
}

/** Hosts SkySlope serves document binaries from (pre-signed, read-only GET). */
const SKYSLOPE_DOCUMENT_HOSTS: ReadonlySet<string> = new Set(['skyslope-documents.s3.amazonaws.com'])

export function assertInboundRequest(method: string, url: string): void {
  const u = new URL(url)
  const m = method.toUpperCase()
  if (u.protocol === 'https:' && SKYSLOPE_DOCUMENT_HOSTS.has(u.host)) {
    if (m === 'GET') return
    throw new Error(`SkySlope inbound refused ${m} ${u.host}`)
  }
  if (u.origin !== SKYSLOPE_FILES_BASE) {
    throw new Error(`SkySlope inbound refused host ${u.origin}`)
  }
  const path = u.pathname
  if (m === 'POST' && path === '/auth/login') return
  if (m === 'GET' && /^\/api\/files\/(sales|listings)(\/[A-Za-z0-9-]+)?$/.test(path)) return
  if (m === 'GET' && /^\/api\/files\/(sales|listings)\/[A-Za-z0-9-]+\/documents(\/[A-Za-z0-9-]+\/binary)?$/.test(path)) return
  throw new Error(`SkySlope inbound refused ${m} ${path}`)
}

/**
 * The folder list answers HTTP 422 ("Please check your query parameters") for
 * a page past the end instead of an empty page, so a folder count that lands
 * on an exact multiple of the page size used to fail the whole refresh
 * (production 2026-09-23 and 09-24: "sales page 5: HTTP 422" at 40 sale
 * folders). A 422 after a full page is the end of the list; a 422 on page 1,
 * or after a short page, is still an error.
 */
export function folderPageIsPastEnd(status: number, pageNumber: number, previousPageRows: number): boolean {
  return status === 422 && pageNumber > 1 && previousPageRows >= PAGE_SIZE
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function inboundFetch(url: string, init: RequestInit, maxAttempts = 8): Promise<Response> {
  assertInboundRequest(init.method ?? 'GET', url)
  let lastStatus = 0
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await fetch(url, init)
    lastStatus = r.status
    if (r.status === 429 || r.status === 503) {
      await sleep(Math.min(30_000, 400 * 2 ** attempt))
      continue
    }
    return r
  }
  throw new Error(`SkySlope rate limited after ${maxAttempts} attempts (last HTTP ${lastStatus})`)
}

export async function loginSkySlopeInbound(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (!hasSkySlopeInboundCreds(env)) {
    throw new Error('SKYSLOPE_ACCESS_KEY / ACCESS_SECRET / CLIENT_ID / CLIENT_SECRET missing')
  }
  const ts = new Date().toISOString()
  const hmac = createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET!.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID!.trim()}:${env.SKYSLOPE_CLIENT_SECRET!.trim()}:${ts}`)
    .digest('base64')
  const r = await inboundFetch(`${SKYSLOPE_FILES_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY!.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID!.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET!.trim(),
    }),
  })
  const j = (await r.json()) as { Session?: string }
  if (!j.Session) throw new Error(`SkySlope login failed HTTP ${r.status}`)
  return j.Session
}

function sessionHeaders(session: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

function dateRangeUnixSec() {
  return {
    earliestDate: Math.floor(Date.UTC(1990, 0, 1, 0, 0, 0) / 1000),
    latestDate: Math.floor(Date.UTC(2037, 11, 31, 23, 59, 59) / 1000),
  }
}

export async function listSkySlopeFolders(
  session: string,
  kind: SkySlopeFolderKind,
): Promise<Record<string, unknown>[]> {
  const valueKey = kind === 'listings' ? 'listings' : 'sales'
  const all: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const { earliestDate, latestDate } = dateRangeUnixSec()
  let previousPageRows = 0
  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const params = new URLSearchParams({
      earliestDate: String(earliestDate),
      latestDate: String(latestDate),
      pageNumber: String(pageNumber),
    })
    const url = `${SKYSLOPE_FILES_BASE}/api/files/${kind}?${params}`
    const r = await inboundFetch(url, { method: 'GET', headers: sessionHeaders(session) })
    if (folderPageIsPastEnd(r.status, pageNumber, previousPageRows)) break
    if (!r.ok) throw new Error(`${kind} page ${pageNumber}: HTTP ${r.status}`)
    const j = (await r.json()) as { value?: Record<string, Array<Record<string, unknown>>> }
    const rows = j?.value?.[valueKey] ?? []
    previousPageRows = rows.length
    for (const row of rows) {
      const id = String((kind === 'listings' ? row.listingGuid : row.saleGuid) ?? '')
      if (id) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      all.push(row)
    }
    if (rows.length < PAGE_SIZE) break
    await sleep(200)
  }
  return all
}

export async function fetchSkySlopeFolderDetail(
  session: string,
  kind: SkySlopeFolderKind,
  guid: string,
): Promise<Record<string, unknown>> {
  const url = `${SKYSLOPE_FILES_BASE}/api/files/${kind}/${guid}`
  const r = await inboundFetch(url, { method: 'GET', headers: sessionHeaders(session) })
  if (!r.ok) return { __error: r.status }
  const j = (await r.json()) as { value?: Record<string, Record<string, unknown>> }
  const detailKey = kind === 'listings' ? 'listing' : 'sale'
  return j?.value?.[detailKey] ?? { __error: 'empty' }
}

/**
 * A folder's document list (the same call the 2026-06-10 migration made). Each
 * row carries a pre-signed `url` good for about five minutes, so download soon
 * after listing. Throws on a non-2xx so a caller never mistakes an outage for
 * an empty folder.
 */
export async function fetchSkySlopeFolderDocuments(
  session: string,
  kind: SkySlopeFolderKind,
  guid: string,
): Promise<Record<string, unknown>[]> {
  const url = `${SKYSLOPE_FILES_BASE}/api/files/${kind}/${guid}/documents`
  const r = await inboundFetch(url, { method: 'GET', headers: sessionHeaders(session) })
  if (!r.ok) throw new Error(`${kind}/${guid.slice(0, 8)} documents: HTTP ${r.status}`)
  const j = (await r.json()) as { value?: { documents?: Record<string, unknown>[] } }
  return j?.value?.documents ?? []
}

/**
 * Download one document binary: the pre-signed `doc.url` when SkySlope gave
 * one, else the folder's binary endpoint. Same headers the migration used
 * (scripts/skyslope-files-api.mjs fetchSkyslopeDocumentBinary): without the
 * Session header some responses come back as HTML or empty bodies.
 */
export async function fetchSkySlopeDocumentBinary(
  session: string,
  kind: SkySlopeFolderKind,
  guid: string,
  docId: string,
  presignedUrl: string | null,
): Promise<{ ok: boolean; status: number; contentType: string; buf: Buffer }> {
  const url = presignedUrl || `${SKYSLOPE_FILES_BASE}/api/files/${kind}/${guid}/documents/${docId}/binary`
  const r = await inboundFetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Session: session,
      timestamp: new Date().toISOString(),
      Accept: 'application/pdf, application/octet-stream, */*',
    },
  })
  const buf = Buffer.from(await r.arrayBuffer())
  return { ok: r.ok, status: r.status, contentType: (r.headers.get('content-type') || '').toLowerCase(), buf }
}

function summarizeChecklist(detail: Record<string, unknown>): { requiredOpen: string[]; activityCount: number; filledCount: number } {
  const checklist = detail.checklist as { activities?: Array<Record<string, unknown>> } | undefined
  const activities = checklist?.activities ?? []
  let filled = 0
  const requiredOpen: string[] = []
  for (const a of activities) {
    const docs = Array.isArray(a.checklistDocs) ? a.checklistDocs : []
    if (docs.length > 0) filled += 1
    if (a.required === true && docs.length === 0) {
      requiredOpen.push(String(a.activityName ?? 'unnamed'))
    }
  }
  return { requiredOpen, activityCount: activities.length, filledCount: filled }
}

export function summarizeSkySlopeFolder(
  kind: SkySlopeFolderKind,
  row: Record<string, unknown>,
  detail: Record<string, unknown>,
): SkySlopeFolderSummary | null {
  const guid = String(
    (kind === 'listings' ? detail.listingGuid ?? row.listingGuid : detail.saleGuid ?? row.saleGuid) ?? '',
  )
  if (!guid) return null
  const agent = (detail.agent ?? row.agent) as { firstName?: unknown; lastName?: unknown; guid?: unknown } | undefined
  const agentName = agent
    ? [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim()
    : String(row.agentName ?? '')
  const checklist = summarizeChecklist(detail)
  return {
    kind,
    guid,
    guid8: guid.slice(0, 8),
    status: (detail.status as string | null) ?? (row.status as string | null) ?? null,
    address:
      (detail.propertyAddress as string | null) ??
      (detail.address as string | null) ??
      (row.propertyAddress as string | null) ??
      (row.address as string | null) ??
      null,
    broker: brokerFromAgentGuid(agent?.guid ?? row.agentGuid) ?? (agentName || null),
    mlsNumber: (detail.mlsNumber as string | null) ?? (detail.mlsNum as string | null) ?? null,
    salePrice: moneyOrNull(detail.salePrice),
    listingPrice: moneyOrNull(detail.listingPrice),
    officeGross: moneyOrNull(
      (detail.commission as { officeGrossCommissionOnSale?: unknown } | undefined)?.officeGrossCommissionOnSale,
    ),
    commissionPercent: moneyOrNull(
      (detail.commission as { saleCommissionPercent?: unknown } | undefined)?.saleCommissionPercent,
    ),
    escrowNumber:
      detail.escrowNumber && String(detail.escrowNumber) !== '0' ? String(detail.escrowNumber) : null,
    sellers: partyNames(detail.sellers),
    buyers: partyNames(detail.buyers),
    contractAcceptanceDate: date10(detail.acceptanceDate ?? detail.contractDate),
    escrowClosingDate: date10(detail.closeDate ?? detail.escrowClosingDate),
    actualClosingDate: date10(detail.actualClosingDate ?? (detail.status === 'Closed' ? detail.closeDate : null)),
    expirationDate: date10(detail.expirationDate),
    createdOn: date10(detail.createdDate ?? row.createdDate),
    requiredOpen: checklist.requiredOpen,
    activityCount: checklist.activityCount,
    filledCount: checklist.filledCount,
  }
}

export async function pullSkySlopeInboundFolders(): Promise<{
  sales: SkySlopeFolderSummary[]
  listings: SkySlopeFolderSummary[]
}> {
  const session = await loginSkySlopeInbound()
  const sales: SkySlopeFolderSummary[] = []
  const listings: SkySlopeFolderSummary[] = []
  for (const kind of ['sales', 'listings'] as const) {
    const rows = await listSkySlopeFolders(session, kind)
    for (const row of rows) {
      const guid = String(kind === 'listings' ? row.listingGuid : row.saleGuid ?? '')
      if (!guid) continue
      const detail = await fetchSkySlopeFolderDetail(session, kind, guid)
      const summary = summarizeSkySlopeFolder(kind, row, detail)
      if (summary) (kind === 'sales' ? sales : listings).push(summary)
      await sleep(150)
    }
  }
  return { sales, listings }
}
