/**
 * G13 unknown-health integration probes. Packet + /admin/loop read this file.
 * reachability: collectCompanyScoreboardSignals, /admin/loop, scripts/check-integration-health.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const INTEGRATION_HEALTH_PATH = 'docs/plans/ENTERPRISE_MAP/integration-health-probes.json'
export const INTEGRATION_HEALTH_SOURCE =
  'docs/plans/ENTERPRISE_MAP/integration-health-probes.json via readIntegrationHealth'

export const G13_UNKNOWN_BEFORE = [
  'INT-021',
  'INT-023',
  'INT-026',
  'INT-029',
  'INT-031',
  'INT-032',
  'INT-033',
  'INT-036',
] as const

export type IntegrationHealthValue = 'green' | 'amber' | 'red' | 'dark' | 'unknown'
export type IntegrationDisposition = 'KEEP' | 'FIX' | 'RECONNECT' | 'PARK' | 'LEGACY_RESIDUE' | 'TOOLING'

export type IntegrationHealthRow = {
  id: string
  system: string
  health: IntegrationHealthValue
  disposition: IntegrationDisposition
  probedAt: string
  httpStatus: number | null
  evidence: string
}

export type IntegrationHealthProbes = {
  status: 'ok' | 'unreadable'
  recordedAt: string | null
  source: string
  versionGap: string
  unknownBefore: string[]
  unknownCount: number
  probedCount: number
  greenCount: number
  parkCount: number
  rows: IntegrationHealthRow[]
}

const HEALTHS = new Set<IntegrationHealthValue>(['green', 'amber', 'red', 'dark', 'unknown'])
const DISPOSITIONS = new Set<IntegrationDisposition>([
  'KEEP',
  'FIX',
  'RECONNECT',
  'PARK',
  'LEGACY_RESIDUE',
  'TOOLING',
])

const UNREAD: IntegrationHealthProbes = {
  status: 'unreadable',
  recordedAt: null,
  source: INTEGRATION_HEALTH_PATH,
  versionGap: 'G13',
  unknownBefore: [...G13_UNKNOWN_BEFORE],
  unknownCount: G13_UNKNOWN_BEFORE.length,
  probedCount: 0,
  greenCount: 0,
  parkCount: 0,
  rows: [],
}

function isHealth(v: unknown): v is IntegrationHealthValue {
  return typeof v === 'string' && HEALTHS.has(v as IntegrationHealthValue)
}

function isDisposition(v: unknown): v is IntegrationDisposition {
  return typeof v === 'string' && DISPOSITIONS.has(v as IntegrationDisposition)
}

export function integrationHealthComplete(d: IntegrationHealthProbes): boolean {
  if (d.status !== 'ok') return false
  if (d.versionGap !== 'G13') return false
  if (d.unknownCount !== 0) return false
  if (d.probedCount !== G13_UNKNOWN_BEFORE.length) return false
  if (d.rows.length !== G13_UNKNOWN_BEFORE.length) return false
  const ids = d.rows.map((r) => r.id).sort()
  const expected = [...G13_UNKNOWN_BEFORE].sort()
  if (ids.join(',') !== expected.join(',')) return false
  if (d.rows.some((r) => r.health === 'unknown')) return false
  if (d.rows.some((r) => !r.evidence.trim() || !r.probedAt.trim())) return false
  const green = d.rows.filter((r) => r.health === 'green').length
  const park = d.rows.filter((r) => r.disposition === 'PARK').length
  if (d.greenCount !== green || d.parkCount !== park) return false
  if (green + park !== G13_UNKNOWN_BEFORE.length) return false
  return true
}

export function readIntegrationHealth(root: string = process.cwd()): IntegrationHealthProbes {
  const path = resolve(root, INTEGRATION_HEALTH_PATH)
  if (!existsSync(path)) return { ...UNREAD }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<IntegrationHealthProbes>
    const rows = Array.isArray(raw.rows)
      ? raw.rows.map((r) => ({
          id: String(r.id ?? ''),
          system: String(r.system ?? ''),
          health: isHealth(r.health) ? r.health : 'unknown',
          disposition: isDisposition(r.disposition) ? r.disposition : 'KEEP',
          probedAt: String(r.probedAt ?? ''),
          httpStatus: typeof r.httpStatus === 'number' ? r.httpStatus : null,
          evidence: String(r.evidence ?? ''),
        }))
      : []
    const parsed: IntegrationHealthProbes = {
      status: raw.status === 'ok' ? 'ok' : 'unreadable',
      recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : null,
      source: INTEGRATION_HEALTH_PATH,
      versionGap: String(raw.versionGap ?? ''),
      unknownBefore: Array.isArray(raw.unknownBefore) ? raw.unknownBefore.map(String) : [],
      unknownCount: Number(raw.unknownCount ?? -1),
      probedCount: Number(raw.probedCount ?? 0),
      greenCount: Number(raw.greenCount ?? 0),
      parkCount: Number(raw.parkCount ?? 0),
      rows,
    }
    if (!integrationHealthComplete(parsed)) return { ...parsed, status: 'unreadable' }
    return parsed
  } catch {
    return { ...UNREAD }
  }
}
