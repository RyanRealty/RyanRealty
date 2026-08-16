import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LOOK_WALK_REQUIRED_ROUTES,
  lookWalkBaselineComplete,
  readLookWalkBaseline,
  type LookWalkBaseline,
  type LookWalkRoute,
} from './look-walk'

function route(path: string): LookWalkRoute {
  return {
    id: path,
    route: path,
    label: path,
    http390: 200,
    http1280: 200,
    jobNoun: 'houses',
    knownPath: { start: 'see homes', now: 'houses', next: 'open a house' },
    quiet: { copyBudgetWords: 10, foci: 4 },
    verdict: 'RECORDED',
    punch: null,
  }
}

function complete(): LookWalkBaseline {
  return {
    status: 'ok',
    recordedAt: '2026-08-16T00:00:00.000Z',
    viewports: ['390', '1280'],
    source: 'docs/plans/ENTERPRISE_MAP/look-walk-baseline.json',
    public: { routes: LOOK_WALK_REQUIRED_ROUTES.map((r) => route(r)) },
    cma: {
      status: 'ok',
      slug: 'cma-19496-tumalo-reservoir',
      url: 'https://ryan-realty.com/cmas/cma-19496-tumalo-reservoir/cma.html',
      pageCount: 13,
      sellerReadableOnePass: true,
      numbersHaveUnits: true,
      coverIsHouse: true,
      verdict: 'WORKING',
      notes: 'test',
    },
  }
}

describe('look-walk baseline', () => {
  it('requires the beat_on public set at both viewports plus a graded CMA', () => {
    expect(lookWalkBaselineComplete(complete())).toBe(true)
    const missing = complete()
    missing.public.routes = missing.public.routes.slice(1)
    expect(lookWalkBaselineComplete(missing)).toBe(false)
    const noCma = complete()
    noCma.cma.verdict = null
    expect(lookWalkBaselineComplete(noCma)).toBe(false)
  })

  it('treats a missing or incomplete file as unreadable', () => {
    const root = mkdtempSync(join(tmpdir(), 'look-walk-'))
    expect(readLookWalkBaseline(root).status).toBe('unreadable')
    mkdirSync(join(root, 'docs/plans/ENTERPRISE_MAP'), { recursive: true })
    writeFileSync(join(root, 'docs/plans/ENTERPRISE_MAP/look-walk-baseline.json'), JSON.stringify(complete()))
    expect(readLookWalkBaseline(root).status).toBe('ok')
    expect(readLookWalkBaseline(root).cma.slug).toBe('cma-19496-tumalo-reservoir')
  })
})
