import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  G15_ACCEPT_IDS,
  G15_LONG_TAIL_TOTAL,
  G15_TTFB_TARGET_MS,
  readSearchCompletenessAccept,
  searchCompletenessComplete,
  type SearchAcceptItem,
  type SearchCompletenessAccept,
  type SearchLongTailRow,
} from './search-completeness'

function item(id: string): SearchAcceptItem {
  return {
    id,
    requirement: id === 'A11' ? '§4.8' : `R-09${id.slice(1)}`,
    text: `${id} text`,
    disposition: id === 'A5' ? 'gated' : id === 'A8' ? 'measured' : 'live',
    reason: `${id} reason`,
  }
}

function row(i: number): SearchLongTailRow {
  return {
    concept: `cf:concept-${i}`,
    kind: i < 222 ? 'custom' : 'standard',
    disposition: 'excluded',
    reasonClass: 'covered',
    reason: 'Covered by an existing registry filter.',
  }
}

function complete(): SearchCompletenessAccept {
  return {
    status: 'ok',
    recordedAt: '2026-08-16T14:36:20.144Z',
    source: 'docs/plans/ENTERPRISE_MAP/search-completeness-accept.json',
    versionGap: 'G15',
    acceptItems: G15_ACCEPT_IDS.map((id) => item(id)),
    longTail: {
      customCount: 222,
      standardCount: 46,
      disposedCount: G15_LONG_TAIL_TOTAL,
      unexplainedCount: 0,
      rows: Array.from({ length: G15_LONG_TAIL_TOTAL }, (_, i) => row(i)),
    },
    perf: {
      measuredAt: '2026-08-16T14:36:41.984Z',
      samples: 8,
      p75: { ttfbHomesForSaleMs: 275, ttfbBendMs: 254 },
      targetTtfbMs: G15_TTFB_TARGET_MS,
    },
  }
}

describe('search completeness accept', () => {
  it('requires every A1–A11 item, 268 long-tail rows, and TTFB p75 under 600ms', () => {
    expect(searchCompletenessComplete(complete())).toBe(true)
    const open = complete()
    open.acceptItems[0] = { ...open.acceptItems[0], reason: '' }
    expect(searchCompletenessComplete(open)).toBe(false)
    const leftover = complete()
    leftover.longTail.unexplainedCount = 1
    expect(searchCompletenessComplete(leftover)).toBe(false)
    const short = complete()
    short.longTail.rows = short.longTail.rows.slice(1)
    short.longTail.disposedCount = G15_LONG_TAIL_TOTAL - 1
    expect(searchCompletenessComplete(short)).toBe(false)
    const slow = complete()
    slow.perf.p75.ttfbHomesForSaleMs = G15_TTFB_TARGET_MS + 1
    expect(searchCompletenessComplete(slow)).toBe(false)
    const missing = complete()
    missing.perf.p75.ttfbBendMs = null
    expect(searchCompletenessComplete(missing)).toBe(false)
  })

  it('treats a missing or incomplete file as unreadable', () => {
    const root = mkdtempSync(join(tmpdir(), 'search-complete-'))
    expect(readSearchCompletenessAccept(root).status).toBe('unreadable')
    mkdirSync(join(root, 'docs/plans/ENTERPRISE_MAP'), { recursive: true })
    writeFileSync(
      join(root, 'docs/plans/ENTERPRISE_MAP/search-completeness-accept.json'),
      JSON.stringify(complete()),
    )
    const read = readSearchCompletenessAccept(root)
    expect(read.status).toBe('ok')
    expect(read.longTail.disposedCount).toBe(G15_LONG_TAIL_TOTAL)
    expect(read.longTail.unexplainedCount).toBe(0)
    expect(read.perf.p75.ttfbHomesForSaleMs).toBe(275)
    expect(read.perf.p75.ttfbBendMs).toBe(254)
  })
})
