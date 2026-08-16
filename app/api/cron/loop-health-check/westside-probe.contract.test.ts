import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WESTSIDE_AUDIENCE_ID } from '@/lib/meta-westside-audience'
import { evalAudienceSync, HEARTBEAT_THRESHOLDS } from '@/lib/pipeline-heartbeat'

/**
 * W1.1 — the West Side audience heartbeat must be WEST-SIDE-SPECIFIC.
 *
 * meta_audience_log is a SHARED ledger: the daily general CRM-audience sync
 * (meta-audience-sync) writes rows too. The original probe read max(ran_at) over
 * the WHOLE table, so the daily CRM writes masked the weekly West Side refresh —
 * a false green while the West Side audience (that Ryan Realty paid to build)
 * went dark. This pins the fix: the probe scopes meta_audience_log to the West
 * Side audience_id, so only a real West Side push keeps it green.
 */
const route = readFileSync(resolve('app/api/cron/loop-health-check/route.ts'), 'utf8')

describe('loop-health-check West Side audience probe is scoped to WESTSIDE_AUDIENCE_ID', () => {
  it('probes meta_audience_log filtered by audience_id = WESTSIDE_AUDIENCE_ID', () => {
    expect(route).toMatch(/latestTimestamp\('meta_audience_log', 'ran_at', \{/)
    expect(route).toMatch(/column: 'audience_id'/)
    expect(route).toMatch(/value: WESTSIDE_AUDIENCE_ID/)
    expect(route).toMatch(/import \{ WESTSIDE_AUDIENCE_ID \} from '@\/lib\/meta-westside-audience'/)
  })

  it('latestTimestamp accepts an equality filter (so other writers cannot mask a pipeline)', () => {
    expect(route).toMatch(/eq\?: \{ column: string; value: string \}/)
    expect(route).toMatch(/if \(eq\) q = q\.eq\(eq\.column, eq\.value\)/)
  })
})

describe('evalAudienceSync still grades the West Side freshness (mechanism bites)', () => {
  const NOW = new Date('2026-07-23T12:00:00Z')
  it('green when a West Side push is recent, red when stale or never', () => {
    expect(evalAudienceSync(new Date(NOW.getTime() - 20 * 3_600_000).toISOString(), NOW).status).toBe('green')
    expect(
      evalAudienceSync(
        new Date(NOW.getTime() - HEARTBEAT_THRESHOLDS.audienceSyncHours * 3_600_000).toISOString(),
        NOW,
      ).status,
    ).toBe('red')
    // never (null max) reads red — a West Side audience with ZERO ledger rows is dark.
    expect(evalAudienceSync(null, NOW).status).toBe('red')
  })
})
