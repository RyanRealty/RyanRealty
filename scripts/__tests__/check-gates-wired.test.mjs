import { describe, expect, it } from 'vitest'
import {
  KNOWN_UNWIRED,
  collectLaneGates,
  evaluateWiredState,
  parseChainGateNames,
} from '../check-gates-wired.mjs'

const CHAIN = 'npm run ci:alpha && npm run ci:beta'

function scripts(extra = {}) {
  return {
    'ci:gates': 'node scripts/run-ci-gates.mjs',
    'ci:gates:chain': CHAIN,
    'ci:alpha': 'node scripts/check-alpha.mjs',
    'ci:beta': 'node scripts/check-beta.mjs',
    'ci:alpha:baseline': 'node scripts/check-alpha.mjs --write-baseline',
    'ci:routes': 'node scripts/index-routes.mjs',
    'ci:data-access': 'node scripts/check-data-access.mjs',
    ...extra,
  }
}

describe('parseChainGateNames', () => {
  it('extracts unique ci:* names from the chain string', () => {
    expect(parseChainGateNames(CHAIN)).toEqual(['ci:alpha', 'ci:beta'])
  })
})

describe('collectLaneGates', () => {
  it('reads always/nightly/cert arrays and path object keys', () => {
    const names = collectLaneGates({
      always: ['ci:alpha'],
      path: { 'ci:cma-routing': ['lib/cma/**'] },
      nightly: ['ci:lighthouse'],
      cert: ['ci:version-manifest'],
    })
    expect([...names].sort()).toEqual([
      'ci:alpha',
      'ci:cma-routing',
      'ci:lighthouse',
      'ci:version-manifest',
    ])
  })
})

describe('evaluateWiredState — wired definition', () => {
  it('counts a nightly-only gate as wired even when it is off the chain', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:nightly-only': 'node scripts/check-nightly-only.mjs' }),
      lanes: { always: ['ci:alpha', 'ci:beta'], path: {}, nightly: ['ci:nightly-only'], cert: [] },
      checkFiles: ['check-alpha.mjs', 'check-beta.mjs', 'check-nightly-only.mjs'],
    })
    expect(r.ciOrphans).toEqual([])
    expect(r.failed).toBe(false)
  })

  it('counts a cert-only gate as wired even when it is off the chain', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:cert-only': 'node scripts/check-cert-only.mjs' }),
      lanes: { always: ['ci:alpha', 'ci:beta'], path: {}, nightly: [], cert: ['ci:cert-only'] },
    })
    expect(r.ciOrphans).toEqual([])
  })

  it('counts a path-key gate as wired', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:cma-routing': 'node scripts/check-cma-routing.mjs' }),
      lanes: {
        always: ['ci:alpha', 'ci:beta'],
        path: { 'ci:cma-routing': ['lib/cma/**'] },
        nightly: [],
        cert: [],
      },
    })
    expect(r.ciOrphans).toEqual([])
  })

  it('counts a workflow-named gate as wired without lanes or chain', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:from-workflow': 'node scripts/check-from-workflow.mjs' }),
      workflowText: 'run: npm run ci:from-workflow',
      lanes: null,
    })
    expect(r.ciOrphans).toEqual([])
  })

  it('counts a husky-named gate as wired without lanes or chain', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:from-husky': 'node scripts/check-from-husky.mjs' }),
      huskyText: 'npm run ci:from-husky',
      lanes: null,
    })
    expect(r.ciOrphans).toEqual([])
  })

  it('flags a ci:* script that is in none of chain / lanes / workflow / husky', () => {
    const r = evaluateWiredState({
      scripts: scripts({ 'ci:nowhere': 'node scripts/check-nowhere.mjs' }),
      lanes: { always: ['ci:alpha', 'ci:beta'], path: {}, nightly: [], cert: [] },
    })
    expect(r.ciOrphans).toEqual(['ci:nowhere'])
    expect(r.failed).toBe(true)
  })

  it('does not require KNOWN_UNWIRED or generator scripts to be wired', () => {
    const r = evaluateWiredState({
      scripts: scripts(),
      lanes: null,
    })
    expect(KNOWN_UNWIRED.has('ci:data-access')).toBe(true)
    expect(r.allGates).not.toContain('ci:data-access')
    expect(r.allGates).not.toContain('ci:routes')
    expect(r.allGates).not.toContain('ci:alpha:baseline')
    expect(r.ciOrphans).toEqual([])
  })
})

describe('evaluateWiredState — chain ↔ lanes drift', () => {
  it('skips the drift check when ci-lanes.json is absent', () => {
    const r = evaluateWiredState({ scripts: scripts(), lanes: null })
    expect(r.chainMissingFromLanes).toBeNull()
    expect(r.failed).toBe(false)
  })

  it('fails when a chain member is missing from lanes', () => {
    const r = evaluateWiredState({
      scripts: scripts(),
      lanes: { always: ['ci:alpha'], path: {}, nightly: [], cert: [] },
    })
    expect(r.chainMissingFromLanes).toEqual(['ci:beta'])
    expect(r.failed).toBe(true)
  })

  it('accepts a chain member that was demoted into nightly', () => {
    const r = evaluateWiredState({
      scripts: scripts(),
      lanes: { always: ['ci:alpha'], path: {}, nightly: ['ci:beta'], cert: [] },
    })
    expect(r.chainMissingFromLanes).toEqual([])
    expect(r.failed).toBe(false)
  })
})

describe('evaluateWiredState — file-orphan ratchet', () => {
  it('fails on a new check-*.mjs that runs nowhere', () => {
    const r = evaluateWiredState({
      scripts: scripts(),
      lanes: null,
      checkFiles: ['check-alpha.mjs', 'check-new-orphan.mjs'],
      baselineFiles: [],
    })
    expect(r.newFileOrphans).toEqual(['check-new-orphan.mjs'])
    expect(r.failed).toBe(true)
  })

  it('allows a baselined orphan and does not grow the list', () => {
    const r = evaluateWiredState({
      scripts: scripts(),
      lanes: null,
      checkFiles: ['check-alpha.mjs', 'check-old-orphan.mjs'],
      baselineFiles: ['check-old-orphan.mjs'],
    })
    expect(r.fileOrphans).toEqual(['check-old-orphan.mjs'])
    expect(r.newFileOrphans).toEqual([])
    expect(r.failed).toBe(false)
  })

  it('does not treat a lane-only check file as an orphan', () => {
    const r = evaluateWiredState({
      scripts: {
        'ci:gates:chain': 'npm run ci:alpha',
        'ci:alpha': 'node scripts/check-alpha.mjs',
        'ci:nightly-file': 'node scripts/check-nightly-file.mjs',
      },
      lanes: { always: ['ci:alpha'], path: {}, nightly: ['ci:nightly-file'], cert: [] },
      checkFiles: ['check-alpha.mjs', 'check-nightly-file.mjs'],
      baselineFiles: [],
    })
    expect(r.fileOrphans).toEqual([])
    expect(r.newFileOrphans).toEqual([])
  })
})
