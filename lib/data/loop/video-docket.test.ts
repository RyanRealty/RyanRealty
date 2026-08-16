import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  readVideoDecisionDocket,
  videoDocketComplete,
  type VideoDecisionDocket,
} from './video-docket'

function complete(): VideoDecisionDocket {
  return {
    status: 'ok',
    recordedAt: '2026-08-16T11:28:00.000Z',
    source: 'docs/plans/ENTERPRISE_MAP/video-decision-docket.json',
    capability: 'CAP-017',
    versionGap: 'G12',
    mattMove: 'M3',
    decision: {
      status: 'pending',
      recordedAt: null,
      choice: null,
      note: 'waiting',
    },
    inventory: {
      remotionConfigs: 16,
      deadSafeZoneImports: 11,
      decommissionedProducers: 24,
      mp4OnDisk: 84,
    },
    park: {
      label: 'Park',
      incrementalVendorUsd: 0,
      brainPath: 'Keep R-045. Inbox stays matt_alert.',
      sources: ['incremental vendor $0', 'R-045 LOCKED'],
    },
    rebuild: {
      label: 'Rebuild',
      elevenLabsTurboUsdPer1kChars: 0.05,
      producerCapPerRowUsd: 5,
      producerCapPerRunUsd: 15,
      brainPath: 'Re-add 24 REGISTRY rows. Requires changing R-045.',
      sources: ['ElevenLabs $0.05/1k', 'producer cap $5/row $15/run'],
    },
  }
}

describe('video decision docket', () => {
  it('requires both options costed plus the inventory counts', () => {
    expect(videoDocketComplete(complete())).toBe(true)
    const noParkCost = complete()
    noParkCost.park.incrementalVendorUsd = 12
    expect(videoDocketComplete(noParkCost)).toBe(false)
    const noRebuildRate = complete()
    noRebuildRate.rebuild.elevenLabsTurboUsdPer1kChars = 0.1
    expect(videoDocketComplete(noRebuildRate)).toBe(false)
    const noSources = complete()
    noSources.rebuild.sources = ['only-one']
    expect(videoDocketComplete(noSources)).toBe(false)
  })

  it('treats a missing or incomplete file as unreadable', () => {
    const root = mkdtempSync(join(tmpdir(), 'video-docket-'))
    expect(readVideoDecisionDocket(root).status).toBe('unreadable')
    mkdirSync(join(root, 'docs/plans/ENTERPRISE_MAP'), { recursive: true })
    writeFileSync(
      join(root, 'docs/plans/ENTERPRISE_MAP/video-decision-docket.json'),
      JSON.stringify(complete()),
    )
    const read = readVideoDecisionDocket(root)
    expect(read.status).toBe('ok')
    expect(read.park.incrementalVendorUsd).toBe(0)
    expect(read.rebuild.producerCapPerRowUsd).toBe(5)
    expect(read.decision.status).toBe('pending')
  })
})
