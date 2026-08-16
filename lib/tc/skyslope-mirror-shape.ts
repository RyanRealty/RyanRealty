/**
 * Pure SkySlope inbound-mirror shaping (no I/O).
 * Property keys and stage ranks match scripts/skyslope-master-file.mjs
 * so a cron refresh lands on the same `skyslope_transactions.property_key`.
 */

export const SKYSLOPE_BROKER_BY_GUID8: Record<string, string> = {
  '41c18058': 'Matt Ryan',
  '512ee312': 'Rebecca Peterson',
  '1f5cb058': 'Paul Stevenson',
}

export const SKYSLOPE_MIRROR_CURRENT_HOURS = 36

export type SkySlopeFolderKind = 'sales' | 'listings'

export type SkySlopeFolderSummary = {
  kind: SkySlopeFolderKind
  guid: string
  guid8: string
  status: string | null
  address: string | null
  broker: string | null
  mlsNumber: string | null
  salePrice: number | null
  listingPrice: number | null
  officeGross: number | null
  commissionPercent: number | null
  escrowNumber: string | null
  sellers: string[]
  buyers: string[]
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  expirationDate: string | null
  createdOn: string | null
  requiredOpen: string[]
  activityCount: number
  filledCount: number
}

export type SkySlopePropertyRow = {
  property_key: string
  address: string
  broker: string | null
  stage: string
  stage_detail: string
  zombie: string | null
  compliance_state: string
  headline: SkySlopeFolderSummary
  cycles: SkySlopeFolderSummary[]
  rollup: {
    folderCount: number
    openFlagCount: number
    docGapCount: number
    bnActionCount: number
    complianceState: string
  }
}

export function normalizeSkySlopeAddress(addr: string | null | undefined): string {
  return (addr || '')
    .toLowerCase()
    .replace(/\b(nw|ne|sw|se|n|s|e|w)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function skySlopePropertyKey(addr: string | null | undefined, guid?: string | null): string {
  const n = normalizeSkySlopeAddress(addr)
  if (!n) return guid ? `guid-${guid.slice(0, 8)}` : 'guid-unknown'
  const parts = n.split(' ')
  return `${parts[0]}-${parts[1] || ''}`
}

export function moneyOrNull(v: unknown): number | null {
  if (v == null || v === '' || v === 0) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return null
  return Math.round(n * 100) / 100
}

export function date10(v: unknown): string | null {
  if (v == null) return null
  const s = String(v)
  if (!s || s.startsWith('0001')) return null
  return s.slice(0, 10)
}

export function partyNames(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .map((p) => {
      if (!p || typeof p !== 'object') return ''
      const row = p as { firstName?: unknown; lastName?: unknown }
      return [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
    })
    .filter(Boolean)
}

export function brokerFromAgentGuid(guid: unknown): string | null {
  if (guid == null) return null
  const key = String(guid).slice(0, 8)
  return SKYSLOPE_BROKER_BY_GUID8[key] ?? null
}

function cycleRank(r: SkySlopeFolderSummary): number {
  if (r.kind === 'listings') return 90
  if (r.status === 'Closed') return 0
  if (r.status === 'Pending') return 1
  if (r.status === 'Pre-Contract') return 2
  return 50
}

export function stageFromCycles(recs: SkySlopeFolderSummary[]): {
  stage: string
  stageDetail: string
  zombie: string | null
  headline: SkySlopeFolderSummary
} {
  const sales = recs.filter((r) => r.kind === 'sales')
  const listing = recs.find((r) => r.kind === 'listings')
  const closed = sales.find((r) => r.status === 'Closed')
  const pending = sales.find((r) => r.status === 'Pending')
  const preContract = sales.find((r) => r.status === 'Pre-Contract')
  const activeListing = listing && listing.status === 'Active' ? listing : null
  if (!recs[0]) {
    throw new Error('stageFromCycles requires at least one folder')
  }
  const headline = closed || pending || activeListing || preContract || recs[0]
  const zombie =
    preContract && closed
      ? `Pre-Contract folder ${preContract.guid8} is a zombie duplicate (deal already closed)`
      : null
  if (pending) {
    return {
      stage: 'pending',
      stageDetail: `Under contract — closes ${pending.escrowClosingDate || '?'}`,
      zombie,
      headline,
    }
  }
  if (activeListing) {
    return {
      stage: 'active_listing',
      stageDetail: `On market — listing expires ${activeListing.expirationDate || '?'}`,
      zombie,
      headline,
    }
  }
  if (closed) {
    return {
      stage: 'closed',
      stageDetail: `Closed ${closed.actualClosingDate || '?'}`,
      zombie,
      headline,
    }
  }
  if (preContract) {
    return { stage: 'pre_contract', stageDetail: 'Pre-contract', zombie, headline }
  }
  return { stage: 'dead', stageDetail: 'All cycles canceled', zombie, headline }
}

export function groupFoldersIntoProperties(folders: SkySlopeFolderSummary[]): SkySlopePropertyRow[] {
  const props = new Map<string, { key: string; address: string; folders: SkySlopeFolderSummary[] }>()
  for (const f of folders) {
    const key = skySlopePropertyKey(f.address, f.guid)
    if (!props.has(key)) {
      props.set(key, { key, address: f.address || '(blank)', folders: [] })
    }
    const p = props.get(key)!
    if ((f.address || '').length > (p.address || '').length) p.address = f.address || p.address
    p.folders.push(f)
  }

  const properties: SkySlopePropertyRow[] = []
  for (const p of props.values()) {
    const recs = [...p.folders].sort((a, b) => cycleRank(a) - cycleRank(b))
    const staged = stageFromCycles(recs)
    const openRequired = recs.reduce((n, r) => n + r.requiredOpen.length, 0)
    const complianceState = openRequired > 0 ? 'action_needed' : 'clean'
    properties.push({
      property_key: p.key,
      address: p.address,
      broker: recs.map((r) => r.broker).find(Boolean) || null,
      stage: staged.stage,
      stage_detail: staged.stageDetail,
      zombie: staged.zombie,
      compliance_state: complianceState,
      headline: staged.headline,
      cycles: recs,
      rollup: {
        folderCount: recs.length,
        openFlagCount: 0,
        docGapCount: openRequired,
        bnActionCount: 0,
        complianceState,
      },
    })
  }
  return properties
}

export function isSkySlopeMirrorCurrent(latestSyncedAt: string | null, now: Date = new Date()): boolean {
  if (!latestSyncedAt) return false
  const t = new Date(latestSyncedAt).getTime()
  if (!Number.isFinite(t)) return false
  return (now.getTime() - t) / 3_600_000 < SKYSLOPE_MIRROR_CURRENT_HOURS
}
