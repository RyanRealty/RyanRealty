/**
 * SkySlope Files API inbound client — READ ONLY after session login.
 *
 * Allowed calls:
 *   POST /auth/login          (HMAC session; not a transaction-file mutation)
 *   GET  /api/files/sales
 *   GET  /api/files/listings
 *   GET  /api/files/sales/:guid
 *   GET  /api/files/listings/:guid
 *
 * Never PUT / PATCH / DELETE. Never POST except /auth/login.
 * Vault (`tc_*`) is the transaction SoR. This client feeds the recon mirror only.
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

export function assertInboundRequest(method: string, url: string): void {
  const u = new URL(url)
  if (u.origin !== SKYSLOPE_FILES_BASE) {
    throw new Error(`SkySlope inbound refused host ${u.origin}`)
  }
  const path = u.pathname
  const m = method.toUpperCase()
  if (m === 'POST' && path === '/auth/login') return
  if (m === 'GET' && /^\/api\/files\/(sales|listings)(\/[A-Za-z0-9-]+)?$/.test(path)) return
  throw new Error(`SkySlope inbound refused ${m} ${path}`)
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
  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const params = new URLSearchParams({
      earliestDate: String(earliestDate),
      latestDate: String(latestDate),
      pageNumber: String(pageNumber),
    })
    const url = `${SKYSLOPE_FILES_BASE}/api/files/${kind}?${params}`
    const r = await inboundFetch(url, { method: 'GET', headers: sessionHeaders(session) })
    if (!r.ok) throw new Error(`${kind} page ${pageNumber}: HTTP ${r.status}`)
    const j = (await r.json()) as { value?: Record<string, unknown[]> }
    const rows = j?.value?.[valueKey] ?? []
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
