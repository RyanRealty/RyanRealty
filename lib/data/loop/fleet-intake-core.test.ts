import { describe, expect, it } from 'vitest'
import { fleetNodePriority } from './work-node'
import {
  FLEET_PUNCH_ACCEPT,
  FLEET_PUNCH_CONTRACT,
  FLEET_PUNCH_GAP,
  FLEET_PUNCH_OUTPUT,
  FLEET_PUNCH_TITLE_BODY,
  appendPunchDispositions,
  appendPunchLine,
  canCompletePunchList,
  findFleetPunchListNode,
  openPunchLines,
  parsePunchLines,
  fleetFingerprintTag,
  fleetPunchListTitle,
  formatFleetPunchLine,
  isFleetPunchListTitle,
  isFoldableFleetSingle,
  mergeFleetIntake,
  objectiveHasFingerprint,
  punchLineFromSingleNode,
  punchTitleSeverity,
  regressGapOf,
  type FleetIntakeActiveNode,
  type FleetIntakeFinding,
} from './fleet-intake-core'

function finding(partial: Partial<FleetIntakeFinding> & Pick<FleetIntakeFinding, 'id' | 'fingerprint'>): FleetIntakeFinding {
  return {
    bot: 'walker-mobile',
    case_id: 'core-places',
    url: 'https://ryan-realty.com/neighborhoods',
    viewport: '390',
    expected: 'counts match across the index and the place page',
    observed: 'index tile 52 vs place hero 63',
    severity: 'p0',
    domain: 'public-ux',
    ...partial,
  }
}

function node(partial: Partial<FleetIntakeActiveNode> & Pick<FleetIntakeActiveNode, 'id'>): FleetIntakeActiveNode {
  return {
    title: 'CMA/pricing production residual',
    objective: 'planned gap work',
    state: 'open',
    owner_session: null,
    version_gap: 'G16',
    domain: 'public-ux',
    ...partial,
  }
}

function punchNode(id = 'punch-1', extras?: Partial<FleetIntakeActiveNode>): FleetIntakeActiveNode {
  return node({
    id,
    title: fleetPunchListTitle('major'),
    objective: FLEET_PUNCH_CONTRACT,
    version_gap: FLEET_PUNCH_GAP,
    ...extras,
  })
}

function singleFindingNode(
  id: string,
  fingerprint: string,
  extras?: Partial<FleetIntakeActiveNode> & { severity?: string; url?: string; observed?: string },
): FleetIntakeActiveNode {
  const severity = extras?.severity ?? 'p0'
  const url = extras?.url ?? 'https://ryan-realty.com/neighborhoods/awbrey-butte'
  const observed = extras?.observed ?? 'tile 52 vs place 63'
  return node({
    id,
    title: `Fleet finding [${severity}]: ${observed}`,
    objective: `${fleetFingerprintTag(fingerprint)} — bot walker-mobile (case core-places) at ${url} [390]: expected "match" but observed "${observed}". FIRST STEP: reproduce it yourself.`,
    version_gap: null,
    ...extras,
  })
}

describe('fleet punch-list identity', () => {
  it('keeps the punch-list title queue-visible to fleetNodePriority', () => {
    expect(fleetNodePriority(fleetPunchListTitle('p0'))).toBe(0)
    expect(fleetNodePriority(fleetPunchListTitle('major'))).toBe(1)
    expect(isFleetPunchListTitle(fleetPunchListTitle('p0'))).toBe(true)
    expect(isFleetPunchListTitle(`Fleet finding [p0]: ${FLEET_PUNCH_TITLE_BODY}`)).toBe(true)
    expect(isFleetPunchListTitle('Fleet finding [p0]: tile 52 vs place 63')).toBe(false)
  })

  it('finds the punch list by version_gap FLEET-PUNCH or the stable title', () => {
    const byGap = punchNode()
    const byTitle = punchNode('punch-2', { version_gap: null, title: fleetPunchListTitle('p0') })
    expect(findFleetPunchListNode([byGap])?.id).toBe('punch-1')
    expect(findFleetPunchListNode([byTitle])?.id).toBe('punch-2')
    expect(findFleetPunchListNode([node({ id: 'g16' })])).toBeNull()
  })
})

describe('punch-line append + duplicate fingerprint', () => {
  it('formats severity, url, trimmed observed, and fleet:fingerprint', () => {
    expect(
      formatFleetPunchLine({
        severity: 'p0',
        url: 'https://ryan-realty.com/neighborhoods',
        observed: '  tile 52 vs place 63  ',
        fingerprint: 'abc123def456',
      }),
    ).toBe(
      '- [p0] https://ryan-realty.com/neighborhoods — tile 52 vs place 63 fleet:abc123def456',
    )
  })

  it('puts expected, viewport, and bot back on the punch line when present', () => {
    expect(
      formatFleetPunchLine({
        severity: 'p0',
        url: 'https://ryan-realty.com/homes-for-sale/bend',
        observed: 'chips are 0x0',
        expected: 'filter chips are usable',
        viewport: '390',
        bot: 'walker-mobile',
        fingerprint: 'abc123def456',
      }),
    ).toBe(
      '- [p0] https://ryan-realty.com/homes-for-sale/bend [390] — expected "filter chips are usable" observed "chips are 0x0" walker-mobile fleet:abc123def456',
    )
    const parsed = parsePunchLines(
      formatFleetPunchLine({
        severity: 'major',
        url: '/search/bend',
        observed: 'empty pins',
        expected: 'pins match the list',
        viewport: '1280',
        bot: 'stats-truth',
        fingerprint: 'deadbeefdeadbeef',
      }),
    )
    expect(parsed[0]).toMatchObject({
      url: '/search/bend',
      expected: 'pins match the list',
      observed: 'empty pins',
      viewport: '1280',
      bot: 'stats-truth',
      fingerprint: 'deadbeefdeadbeef',
    })
  })

  it('skips append when the fingerprint tag is already in the objective', () => {
    const line = formatFleetPunchLine({
      severity: 'major',
      url: 'https://ryan-realty.com/',
      observed: 'two CTAs',
      fingerprint: 'deadbeef',
    })
    const once = appendPunchLine(FLEET_PUNCH_CONTRACT, line)
    expect(once).toContain('fleet:deadbeef')
    expect(appendPunchLine(once, line)).toBe(once)
    expect(objectiveHasFingerprint(once, 'deadbeef')).toBe(true)
  })

  it('raises the title to p0 when any punch line is p0, otherwise major', () => {
    const minorLine = formatFleetPunchLine({
      severity: 'minor',
      url: 'https://ryan-realty.com/',
      observed: 'spacing',
      fingerprint: 'aaa',
    })
    const p0Line = formatFleetPunchLine({
      severity: 'p0',
      url: 'https://ryan-realty.com/sell',
      observed: 'funnel dead',
      fingerprint: 'bbb',
    })
    expect(punchTitleSeverity(appendPunchLine(FLEET_PUNCH_CONTRACT, minorLine))).toBe('major')
    expect(punchTitleSeverity(appendPunchLine(FLEET_PUNCH_CONTRACT, p0Line))).toBe('p0')
    expect(punchTitleSeverity(FLEET_PUNCH_CONTRACT, 'p0')).toBe('p0')
  })
})

describe('mergeFleetIntake (one building node, not a drip)', () => {
  it('appends two p0/major findings onto one punch-list draft — no second node', () => {
    const a = finding({ id: 'f1', fingerprint: '11111111111111111111111111111111', observed: 'tile 52 vs 63' })
    const b = finding({
      id: 'f2',
      fingerprint: '22222222222222222222222222222222',
      url: 'https://ryan-realty.com/communities/tetherow',
      observed: 'hero count 35 vs list 19',
      severity: 'major',
    })
    const plan = mergeFleetIntake([a, b], [])
    expect(plan.punch).not.toBeNull()
    expect(plan.punch?.created).toBe(true)
    expect(plan.punch?.appended).toBe(2)
    expect(plan.punch?.versionGap).toBe(FLEET_PUNCH_GAP)
    expect(plan.punch?.title).toBe(fleetPunchListTitle('p0'))
    expect(plan.punch?.objective).toContain(FLEET_PUNCH_CONTRACT)
    expect(plan.punch?.objective).toContain('fleet:11111111111111111111111111111111')
    expect(plan.punch?.objective).toContain('fleet:22222222222222222222222222222222')
    expect(plan.punch?.output).toBe(FLEET_PUNCH_OUTPUT)
    expect(plan.punch?.accept).toBe(FLEET_PUNCH_ACCEPT)
    expect(plan.punchFindingIds).toEqual(['f1', 'f2'])
    expect(plan.regressions).toHaveLength(0)
  })

  it('appends a new finding after a slice disposition without rewriting the store', () => {
    const existing = punchNode('punch-1', {
      state: 'in_progress',
      owner_session: 'bc-slice',
      objective: appendPunchDispositions(
        `${FLEET_PUNCH_CONTRACT}\n${formatFleetPunchLine({
          severity: 'p0',
          url: 'https://ryan-realty.com/homes-for-sale/bend',
          observed: 'chips are 0x0',
          fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        })}`,
        [{ fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', status: 'fixed', note: 'READY search' }],
      ),
    })
    const f = finding({
      id: 'f-new',
      fingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      url: 'https://ryan-realty.com/team',
      observed: 'bio wrap',
    })
    const plan = mergeFleetIntake([f], [existing])
    expect(plan.punch?.id).toBe('punch-1')
    expect(plan.punch?.objective).toContain('fleet:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(plan.punch?.objective).toContain('- [fixed] fleet:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(plan.punch?.objective).toContain('fleet:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(openPunchLines(plan.punch?.objective ?? '').map((l) => l.fingerprint)).toEqual([
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ])
  })

  it('finds an existing punch list and grows its objective instead of creating', () => {
    const existing = punchNode()
    const f = finding({ id: 'f3', fingerprint: '33333333333333333333333333333333' })
    const plan = mergeFleetIntake([f], [existing])
    expect(plan.punch?.id).toBe('punch-1')
    expect(plan.punch?.created).toBe(false)
    expect(plan.punch?.appended).toBe(1)
    expect(plan.punch?.objective).toContain(FLEET_PUNCH_CONTRACT)
    expect(plan.punch?.objective).toContain('fleet:33333333333333333333333333333333')
    expect(plan.punch?.title).toBe(fleetPunchListTitle('p0'))
  })

  it('marks a fingerprint already on an open objective as duplicate — no append', () => {
    const existing = punchNode('punch-1', {
      objective: `${FLEET_PUNCH_CONTRACT}\n- [p0] https://ryan-realty.com/x — seen fleet:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
    })
    const f = finding({ id: 'f4', fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
    const plan = mergeFleetIntake([f], [existing])
    expect(plan.duplicates).toEqual(['f4'])
    expect(plan.punch).toBeNull()
    expect(plan.punchFindingIds).toHaveLength(0)
  })

  it('records info as a baseline and creates no punch list', () => {
    const f = finding({
      id: 'f5',
      fingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      severity: 'info',
      observed: 'search door is present and usable',
    })
    const plan = mergeFleetIntake([f], [])
    expect(plan.baselines).toEqual(['f5'])
    expect(plan.punch).toBeNull()
    expect(plan.regressions).toHaveLength(0)
  })

  it('keeps regress-G* CHANGE findings as their own node, not a punch line', () => {
    const f = finding({
      id: 'f6',
      fingerprint: 'cccccccccccccccccccccccccccccccc',
      case_id: 'regress-G16',
      observed: 'search completeness accept flipped',
    })
    const plan = mergeFleetIntake([f], [], {
      G16: { domain: 'public-ux', title: 'Search completeness to plan acceptance' },
    })
    expect(plan.punch).toBeNull()
    expect(plan.regressions).toHaveLength(1)
    expect(plan.regressions[0]?.gap).toBe('G16')
    expect(plan.regressions[0]?.title).toMatch(/^Fleet finding \[p0\]:/)
    expect(plan.regressions[0]?.objective).toContain('REGRESSION of G16')
    expect(plan.regressions[0]?.objective).toContain('fleet:cccccccccccccccccccccccccccccccc')
    expect(regressGapOf('regress-G16')).toBe('G16')
    expect(regressGapOf('regress-FLEET-PUNCH')).toBeNull()
    expect(regressGapOf('core-places')).toBeNull()
  })

  it('does not fold a regression single or an in_progress claimed node', () => {
    const claimed = singleFindingNode('claimed', 'dddddddddddddddddddddddddddddddd', {
      state: 'in_progress',
      owner_session: 'bc-13c50db8',
    })
    const blockedClaimed = singleFindingNode('blocked-owned', 'abababababababababababababababab', {
      state: 'blocked',
      owner_session: 'bc-13c50db8',
    })
    const regression = singleFindingNode('reg', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', {
      objective: `${fleetFingerprintTag('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')} — REGRESSION of G16 ("Search completeness" — was DONE and accepted). bot regression-certifier at https://ryan-realty.com/`,
    })
    expect(isFoldableFleetSingle(claimed)).toBe(false)
    expect(isFoldableFleetSingle(blockedClaimed)).toBe(false)
    expect(isFoldableFleetSingle(regression)).toBe(false)
    const plan = mergeFleetIntake([], [claimed, blockedClaimed, regression])
    expect(plan.fold).toHaveLength(0)
    expect(plan.punch).toBeNull()
  })

  it('folds unclaimed OPEN and BLOCKED Fleet finding [ singles into the punch list and keeps their fingerprint tags', () => {
    const orphan = singleFindingNode('orphan', 'ffffffffffffffffffffffffffffffff', {
      observed: 'Awbrey tile 52 vs place 63',
    })
    const blocked = singleFindingNode('blocked', '12121212121212121212121212121212', {
      state: 'blocked',
      owner_session: null,
      url: 'https://ryan-realty.com/homes-for-sale',
      observed: 'filter chips are 0x0',
    })
    const plan = mergeFleetIntake([], [orphan, blocked])
    expect(plan.fold.map((f) => f.id).sort()).toEqual(['blocked', 'orphan'])
    expect(plan.fold.some((f) => f.line.includes('fleet:ffffffffffffffffffffffffffffffff'))).toBe(true)
    expect(plan.fold.some((f) => f.line.includes('fleet:12121212121212121212121212121212'))).toBe(true)
    expect(plan.punch?.created).toBe(true)
    expect(plan.punch?.appended).toBe(0)
    expect(plan.punch?.objective).toContain('fleet:ffffffffffffffffffffffffffffffff')
    expect(plan.punch?.objective).toContain('Awbrey tile 52 vs place 63')
    expect(plan.punch?.objective).toContain('fleet:12121212121212121212121212121212')
    expect(punchLineFromSingleNode(orphan)).toContain('fleet:ffffffffffffffffffffffffffffffff')
  })

  it('parses punch lines and treats fixed/rejected fingerprints as closed', () => {
    const a = formatFleetPunchLine({
      severity: 'p0',
      url: 'https://ryan-realty.com/homes-for-sale/bend',
      observed: 'chips are 0x0',
      fingerprint: 'aaaaaaaaaaaaaaaa',
    })
    const b = formatFleetPunchLine({
      severity: 'major',
      url: 'https://ryan-realty.com/communities/tetherow',
      observed: 'hero 35 vs list 19',
      fingerprint: 'bbbbbbbbbbbbbbbb',
    })
    const objective = `${FLEET_PUNCH_CONTRACT}\n${a}\n${b}`
    expect(parsePunchLines(objective)).toHaveLength(2)
    expect(canCompletePunchList(objective)).toBe(false)
    const resolved = appendPunchDispositions(objective, [
      { fingerprint: 'aaaaaaaaaaaaaaaa', status: 'fixed', note: 'READY abc · 390+1280' },
    ])
    expect(resolved).toContain(a)
    expect(resolved).toContain('- [fixed] fleet:aaaaaaaaaaaaaaaa — READY abc · 390+1280')
    expect(openPunchLines(resolved).map((l) => l.fingerprint)).toEqual(['bbbbbbbbbbbbbbbb'])
    expect(canCompletePunchList(resolved)).toBe(false)
    const done = appendPunchDispositions(resolved, [
      { fingerprint: 'bbbbbbbbbbbbbbbb', status: 'rejected', note: 'does not reproduce' },
    ])
    expect(openPunchLines(done)).toHaveLength(0)
    expect(canCompletePunchList(done)).toBe(true)
    expect(appendPunchDispositions(done, [
      { fingerprint: 'aaaaaaaaaaaaaaaa', status: 'rejected', note: 'rewrite attempt' },
    ])).toBe(done)
  })

  it('does not fold the punch-list node into itself', () => {
    const punch = punchNode()
    expect(isFoldableFleetSingle(punch)).toBe(false)
    const plan = mergeFleetIntake([], [punch])
    expect(plan.fold).toHaveLength(0)
    expect(plan.punch).toBeNull()
  })
})
