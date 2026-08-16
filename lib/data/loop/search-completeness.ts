/**
 * G15 search-completeness accept ledger. Packet + /admin/loop read this file.
 * reachability: collectCompanyScoreboardSignals, /admin/loop, scripts/check-search-completeness-accept.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const SEARCH_COMPLETENESS_PATH = 'docs/plans/ENTERPRISE_MAP/search-completeness-accept.json'
export const SEARCH_COMPLETENESS_SOURCE =
  'docs/plans/ENTERPRISE_MAP/search-completeness-accept.json via readSearchCompletenessAccept'

export const G15_ACCEPT_IDS = [
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'A7',
  'A8',
  'A9',
  'A10',
  'A11',
] as const

export const G15_LONG_TAIL_TOTAL = 268
export const G15_TTFB_TARGET_MS = 600

export type SearchAcceptDisposition = 'live' | 'gated' | 'measured' | 'excluded'

export type SearchAcceptItem = {
  id: string
  requirement: string
  text: string
  disposition: SearchAcceptDisposition
  reason: string
}

export type SearchLongTailRow = {
  concept: string
  kind: 'custom' | 'standard'
  disposition: string
  reasonClass: string
  reason: string
}

export type SearchCompletenessAccept = {
  status: 'ok' | 'unreadable'
  recordedAt: string | null
  source: string
  versionGap: string
  acceptItems: SearchAcceptItem[]
  longTail: {
    customCount: number
    standardCount: number
    disposedCount: number
    unexplainedCount: number
    rows: SearchLongTailRow[]
  }
  perf: {
    measuredAt: string | null
    samples: number
    p75: { ttfbHomesForSaleMs: number | null; ttfbBendMs: number | null }
    targetTtfbMs: number
  }
}

const DISPOSITIONS = new Set<SearchAcceptDisposition>(['live', 'gated', 'measured', 'excluded'])

const UNREAD: SearchCompletenessAccept = {
  status: 'unreadable',
  recordedAt: null,
  source: SEARCH_COMPLETENESS_PATH,
  versionGap: '',
  acceptItems: [],
  longTail: { customCount: 0, standardCount: 0, disposedCount: 0, unexplainedCount: -1, rows: [] },
  perf: {
    measuredAt: null,
    samples: 0,
    p75: { ttfbHomesForSaleMs: null, ttfbBendMs: null },
    targetTtfbMs: G15_TTFB_TARGET_MS,
  },
}

function isDisposition(v: unknown): v is SearchAcceptDisposition {
  return typeof v === 'string' && DISPOSITIONS.has(v as SearchAcceptDisposition)
}

export function searchCompletenessComplete(d: SearchCompletenessAccept): boolean {
  if (d.status !== 'ok') return false
  if (d.versionGap !== 'G15') return false
  if (d.acceptItems.length !== G15_ACCEPT_IDS.length) return false
  const ids = d.acceptItems.map((i) => i.id)
  if (ids.join(',') !== G15_ACCEPT_IDS.join(',')) return false
  if (d.acceptItems.some((i) => !isDisposition(i.disposition) || !i.reason.trim() || !i.text.trim())) return false
  if (d.longTail.unexplainedCount !== 0) return false
  if (d.longTail.disposedCount !== G15_LONG_TAIL_TOTAL) return false
  if (d.longTail.rows.length !== G15_LONG_TAIL_TOTAL) return false
  const homes = d.perf.p75.ttfbHomesForSaleMs
  const bend = d.perf.p75.ttfbBendMs
  if (homes == null || bend == null) return false
  if (!Number.isFinite(homes) || !Number.isFinite(bend)) return false
  if (homes > G15_TTFB_TARGET_MS || bend > G15_TTFB_TARGET_MS) return false
  if (d.perf.samples < 8) return false
  return true
}

export function readSearchCompletenessAccept(root: string = process.cwd()): SearchCompletenessAccept {
  const path = resolve(root, SEARCH_COMPLETENESS_PATH)
  if (!existsSync(path)) return { ...UNREAD }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SearchCompletenessAccept>
    const acceptItems = Array.isArray(raw.acceptItems)
      ? raw.acceptItems.map((i) => ({
          id: String(i.id ?? ''),
          requirement: String(i.requirement ?? ''),
          text: String(i.text ?? ''),
          disposition: isDisposition(i.disposition) ? i.disposition : 'excluded',
          reason: String(i.reason ?? ''),
        }))
      : []
    const rows: SearchLongTailRow[] = Array.isArray(raw.longTail?.rows)
      ? raw.longTail.rows.map((r) => ({
          concept: String(r.concept ?? ''),
          kind: r.kind === 'standard' ? 'standard' : 'custom',
          disposition: String(r.disposition ?? ''),
          reasonClass: String(r.reasonClass ?? ''),
          reason: String(r.reason ?? ''),
        }))
      : []
    const parsed: SearchCompletenessAccept = {
      status: raw.status === 'ok' ? 'ok' : 'unreadable',
      recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : null,
      source: SEARCH_COMPLETENESS_PATH,
      versionGap: String(raw.versionGap ?? ''),
      acceptItems,
      longTail: {
        customCount: Number(raw.longTail?.customCount ?? 0),
        standardCount: Number(raw.longTail?.standardCount ?? 0),
        disposedCount: Number(raw.longTail?.disposedCount ?? 0),
        unexplainedCount: Number(raw.longTail?.unexplainedCount ?? -1),
        rows,
      },
      perf: {
        measuredAt: typeof raw.perf?.measuredAt === 'string' ? raw.perf.measuredAt : null,
        samples: Number(raw.perf?.samples ?? 0),
        p75: {
          ttfbHomesForSaleMs:
            typeof raw.perf?.p75?.ttfbHomesForSaleMs === 'number' ? raw.perf.p75.ttfbHomesForSaleMs : null,
          ttfbBendMs: typeof raw.perf?.p75?.ttfbBendMs === 'number' ? raw.perf.p75.ttfbBendMs : null,
        },
        targetTtfbMs: Number(raw.perf?.targetTtfbMs ?? G15_TTFB_TARGET_MS),
      },
    }
    if (!searchCompletenessComplete(parsed)) return { ...parsed, status: 'unreadable' }
    return parsed
  } catch {
    return { ...UNREAD }
  }
}
