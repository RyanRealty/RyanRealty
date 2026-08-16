import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  G13_UNKNOWN_BEFORE,
  integrationHealthComplete,
  readIntegrationHealth,
  type IntegrationHealthProbes,
  type IntegrationHealthRow,
} from './integration-health'

function row(partial: Partial<IntegrationHealthRow> & Pick<IntegrationHealthRow, 'id' | 'health' | 'disposition'>): IntegrationHealthRow {
  return {
    system: partial.system ?? partial.id,
    probedAt: partial.probedAt ?? '2026-08-16T11:43:08.533Z',
    httpStatus: partial.httpStatus ?? 200,
    evidence: partial.evidence ?? `${partial.id} probed`,
    ...partial,
  }
}

function complete(): IntegrationHealthProbes {
  const rows: IntegrationHealthRow[] = [
    row({ id: 'INT-021', health: 'green', disposition: 'KEEP' }),
    row({ id: 'INT-023', health: 'green', disposition: 'KEEP' }),
    row({ id: 'INT-026', health: 'dark', disposition: 'PARK' }),
    row({ id: 'INT-029', health: 'dark', disposition: 'PARK' }),
    row({ id: 'INT-031', health: 'green', disposition: 'KEEP' }),
    row({ id: 'INT-032', health: 'green', disposition: 'KEEP' }),
    row({ id: 'INT-033', health: 'dark', disposition: 'PARK' }),
    row({ id: 'INT-036', health: 'green', disposition: 'KEEP' }),
  ]
  return {
    status: 'ok',
    recordedAt: '2026-08-16T11:43:42.231Z',
    source: 'docs/plans/ENTERPRISE_MAP/integration-health-probes.json',
    versionGap: 'G13',
    unknownBefore: [...G13_UNKNOWN_BEFORE],
    unknownCount: 0,
    probedCount: 8,
    greenCount: 5,
    parkCount: 3,
    rows,
  }
}

describe('integration health probes', () => {
  it('requires unknown=0 and every G13 id probed to green or park', () => {
    expect(integrationHealthComplete(complete())).toBe(true)
    const leftover = complete()
    leftover.unknownCount = 1
    leftover.rows[0].health = 'unknown'
    leftover.greenCount = 4
    expect(integrationHealthComplete(leftover)).toBe(false)
    const missing = complete()
    missing.rows = missing.rows.slice(1)
    missing.probedCount = 7
    missing.greenCount = 4
    expect(integrationHealthComplete(missing)).toBe(false)
  })

  it('treats a missing or incomplete file as unreadable', () => {
    const root = mkdtempSync(join(tmpdir(), 'int-health-'))
    expect(readIntegrationHealth(root).status).toBe('unreadable')
    mkdirSync(join(root, 'docs/plans/ENTERPRISE_MAP'), { recursive: true })
    writeFileSync(
      join(root, 'docs/plans/ENTERPRISE_MAP/integration-health-probes.json'),
      JSON.stringify(complete()),
    )
    const read = readIntegrationHealth(root)
    expect(read.status).toBe('ok')
    expect(read.unknownCount).toBe(0)
    expect(read.greenCount).toBe(5)
    expect(read.parkCount).toBe(3)
  })
})
