import { describe, expect, it } from 'vitest'
import {
  DEPLOY_CHECK_FAMILIES,
  DEPLOY_MAX_LISTED_KEYS,
  DEPLOY_TITLE_PREFIX,
  buildDeployDraft,
  deployClaimCommand,
  deployFingerprint,
  deployGap,
  existingNodeLine,
  failureKey,
  failureKeys,
  formatDeployDefectBrief,
  isDeployFoundGap,
  keyPath,
  parseDeployGap,
  parseFailingKeys,
  planFailure,
  reconcileDeployDefects,
  unverifiedPaths,
  type DeployCheckResult,
  type DeployDefectOps,
  type DeployNodeView,
  type DeployVerifyRun,
} from './deploy-defects'
import { assertWorkNodeDraft, fleetNodePriority, isLegalTransition, siteServeTier, type WorkNodeDraft } from './work-node'

const SHA = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'
const AT = '2026-10-14T20:11:00.000Z'

const NOINDEX = [
  '/open-houses/bend: meta robots "noindex, follow" on a sitemap URL',
  '/open-houses/redmond: meta robots "noindex, follow" on a sitemap URL',
]

function fail(family: DeployCheckResult['family'], keys: string[], extra: Partial<DeployCheckResult> = {}): DeployCheckResult {
  return { family, status: 'fail', keys, ...extra }
}
function run(results: DeployCheckResult[], write = true, sha = SHA): DeployVerifyRun {
  return { sha, at: AT, write, results }
}

type StoredNode = DeployNodeView & { parentId?: string | null }

/** An in-memory work graph that enforces the real transition table, so the fake cannot be kinder than the DAL. */
function memory(seed: StoredNode[] = []) {
  const nodes: StoredNode[] = seed.map((n) => ({ ...n }))
  const calls = { list: 0, create: 0, claim: [] as string[][], complete: [] as string[][], release: [] as string[] }
  let seq = 0
  const byId = (id: string) => nodes.find((n) => n.id === id)
  const ops: DeployDefectOps = {
    async list() {
      calls.list += 1
      return nodes.map((n) => ({ ...n }))
    },
    async create(draft: WorkNodeDraft) {
      calls.create += 1
      assertWorkNodeDraft(draft)
      if (nodes.some((n) => n.versionGap === draft.versionGap)) {
        return { id: null, error: 'duplicate key value violates unique constraint "loop_work_nodes_version_gap_uq"' }
      }
      const id = `node-${++seq}`
      nodes.push({
        id,
        versionGap: draft.versionGap ?? null,
        title: draft.title,
        objective: draft.objective,
        state: 'open',
        ownerSession: null,
        blockedReason: null,
        evidence: null,
        updatedAt: '2026-10-14T20:11:30.000Z',
        parentId: draft.parentId ?? null,
      })
      return { id, error: null }
    },
    async claim(id, owner) {
      calls.claim.push([id, owner])
      const n = byId(id)
      if (!n || !isLegalTransition(n.state, 'in_progress')) return { ok: false, error: 'update matched no row' }
      n.state = 'in_progress'
      n.ownerSession = owner
      n.updatedAt = '2026-10-14T20:15:00.000Z'
      return { ok: true, error: null }
    },
    async complete(id, evidence) {
      calls.complete.push([id, evidence])
      const n = byId(id)
      if (!n || !isLegalTransition(n.state, 'done') || !evidence.trim()) return { ok: false, error: 'illegal work-node transition' }
      n.state = 'done'
      n.evidence = evidence
      return { ok: true, error: null }
    },
    async release(id) {
      calls.release.push(id)
      const n = byId(id)
      if (!n || !isLegalTransition(n.state, 'open')) return { ok: false, error: 'illegal' }
      n.state = 'open'
      n.ownerSession = null
      return { ok: true, error: null }
    },
  }
  return { ops, nodes, calls }
}

describe('failure identity', () => {
  it('keeps a page line as printed and collapses the counts in an aggregate line', () => {
    expect(failureKey('/open-houses/bend:   meta robots  "noindex" on a sitemap URL')).toBe('/open-houses/bend: meta robots "noindex" on a sitemap URL')
    expect(failureKey('listings.xml: only 80 of 100 URLs carry <image:loc> (floor 90%)')).toBe(
      'listings.xml: only # of # URLs carry <image:loc> (floor #%)',
    )
    expect(failureKey('12 of 80 sampled titles run past 60 chars, over the 15% ceiling: /a: x; /b: y')).toBe(
      '# of # sampled titles run past # chars, over the #% ceiling',
    )
  })

  it('drops a transport error: it is the network answering, not the site', () => {
    expect(failureKeys(['/a: fetch failed (TimeoutError)', '/b: HTTP 404', '/b: HTTP 404'])).toEqual(['/b: HTTP 404'])
  })

  it('fingerprints the same failing set to the same id in any order, and a different set or check to a different one', () => {
    const a = deployFingerprint('sitemap-url-health', failureKeys(NOINDEX))
    expect(a).toMatch(/^[0-9a-f]{10}$/)
    expect(deployFingerprint('sitemap-url-health', failureKeys([...NOINDEX].reverse()))).toBe(a)
    expect(deployFingerprint('sitemap-url-health', failureKeys([NOINDEX[0]]))).not.toBe(a)
    expect(deployFingerprint('live-seo', failureKeys(NOINDEX))).not.toBe(a)
  })

  it('names the node DEPLOY-<check>-<fingerprint>, with -rN for a recurrence, and reads it back', () => {
    const fp = deployFingerprint('sitemap-url-health', failureKeys(NOINDEX))
    expect(deployGap('sitemap-url-health', fp)).toBe(`DEPLOY-sitemap-url-health-${fp}`)
    expect(deployGap('sitemap-url-health', fp, 3)).toBe(`DEPLOY-sitemap-url-health-${fp}-r3`)
    expect(parseDeployGap(`DEPLOY-sitemap-url-health-${fp}-r3`)).toEqual({ family: 'sitemap-url-health', fingerprint: fp, recurrence: 3 })
    expect(parseDeployGap(`DEPLOY-inline-scripts-${fp}`)).toEqual({ family: 'inline-scripts', fingerprint: fp, recurrence: 1 })
    expect(parseDeployGap('SITE-12')).toBeNull()
    expect(parseDeployGap('DEPLOY-not-a-check-0123456789')).toBeNull()
    expect(isDeployFoundGap('DEPLOY-x')).toBe(true)
    expect(isDeployFoundGap('SITE-12')).toBe(false)
    expect(isDeployFoundGap(null)).toBe(false)
  })

  it('reads the path a key names', () => {
    expect(keyPath('/open-houses/bend: meta robots "noindex"')).toBe('/open-houses/bend')
    expect(keyPath('/communities/tetherow [seo-pin-3]: HTTP 404, decision says 200')).toBe('/communities/tetherow')
    expect(keyPath('robots.txt group [*] blocks /communities')).toBeNull()
    expect(keyPath('# of # sampled titles run past # chars')).toBeNull()
  })
})

describe('the node a failure files', () => {
  const keys = failureKeys(NOINDEX)
  const fp = deployFingerprint('sitemap-url-health', keys)

  it('is a complete work-node contract in the factory domain, with the check, the URLs, the deploy and the time', () => {
    const draft = buildDeployDraft({ family: 'sitemap-url-health', keys, sha: SHA, at: AT, fingerprint: fp, recurrence: 1 })
    expect(() => assertWorkNodeDraft(draft)).not.toThrow()
    expect(draft.domain).toBe('factory')
    expect(draft.versionGap).toBe(`DEPLOY-sitemap-url-health-${fp}`)
    expect(draft.title.startsWith(DEPLOY_TITLE_PREFIX)).toBe(true)
    expect(draft.title).toContain('sitemap URL health')
    expect(draft.title).toContain('2 failures')
    expect(draft.objective).toContain('1a2b3c4')
    expect(draft.objective).toContain(AT)
    expect(draft.objective).toContain('npm run seo:sitemap-urls')
    for (const k of keys) expect(draft.objective).toContain(`- ${k}`)
    expect(draft.objective).toContain('Claim this node before you start. If another session holds it, leave it.')
    expect(draft.accept).toContain('deploy:verify completes this node itself')
    expect(draft.parentId).toBeNull()
  })

  it('lists its failing keys back out of the objective, so a later run can tell what it already covers', () => {
    const draft = buildDeployDraft({ family: 'sitemap-url-health', keys, detail: ['400 URLs checked'], sha: SHA, at: AT, fingerprint: fp, recurrence: 1 })
    expect(parseFailingKeys(draft.objective)).toEqual(keys)
    expect(draft.objective).toContain('Observed at filing:\n- 400 URLs checked')
  })

  it('caps the listed keys but says how many are not listed', () => {
    const many = Array.from({ length: DEPLOY_MAX_LISTED_KEYS + 5 }, (_, i) => `/p/${String(i).padStart(4, '0')}: HTTP 404`)
    const draft = buildDeployDraft({ family: 'live-seo', keys: many, sha: SHA, at: AT, fingerprint: deployFingerprint('live-seo', many), recurrence: 1 })
    expect(parseFailingKeys(draft.objective)).toHaveLength(DEPLOY_MAX_LISTED_KEYS)
    expect(draft.objective).toContain('(+5 more failing lines not listed)')
  })

  it('links a recurrence to the done node it follows', () => {
    const draft = buildDeployDraft({
      family: 'sitemap-url-health',
      keys,
      sha: SHA,
      at: AT,
      fingerprint: fp,
      recurrence: 2,
      previous: { gap: `DEPLOY-sitemap-url-health-${fp}`, evidence: 'deploy:verify passed' },
      parentId: 'node-1',
    })
    expect(draft.versionGap).toBe(`DEPLOY-sitemap-url-health-${fp}-r2`)
    expect(draft.parentId).toBe('node-1')
    expect(draft.objective).toContain(`Recurrence 2: DEPLOY-sitemap-url-health-${fp} was done and this failure came back.`)
  })

  it('outranks planned gap work in the serve order, like a fleet major, and the two title strings stay equal', () => {
    expect(fleetNodePriority(`${DEPLOY_TITLE_PREFIX}: sitemap URL health (2 failures)`)).toBe(1)
    expect(siteServeTier(null, `${DEPLOY_TITLE_PREFIX}: sitemap URL health (2 failures)`)).toBe(1)
    expect(fleetNodePriority('Fleet finding [p0]: x')).toBe(0)
  })
})

describe('one defect, one node (planFailure)', () => {
  const keys = failureKeys(NOINDEX)
  const fp = deployFingerprint('sitemap-url-health', keys)
  const node = (over: Partial<StoredNode> = {}): StoredNode => ({
    id: 'n1',
    versionGap: `DEPLOY-sitemap-url-health-${fp}`,
    title: 't',
    objective: buildDeployDraft({ family: 'sitemap-url-health', keys, sha: SHA, at: AT, fingerprint: fp, recurrence: 1 }).objective,
    state: 'open',
    ownerSession: null,
    blockedReason: null,
    evidence: null,
    updatedAt: AT,
    ...over,
  })

  it('files a first failure', () => {
    const plan = planFailure(fail('sitemap-url-health', NOINDEX), [])
    expect(plan.file).toEqual({ fingerprint: fp, recurrence: 1, previous: null })
    expect(plan.covering).toEqual([])
  })

  it('files nothing for a failure an open, claimed or blocked node already lists', () => {
    for (const state of ['open', 'in_progress', 'blocked'] as const) {
      const plan = planFailure(fail('sitemap-url-health', NOINDEX), [node({ state })])
      expect(plan.file, state).toBeNull()
      expect(plan.covering.map((n) => n.id), state).toEqual(['n1'])
    }
  })

  it('treats a partly fixed set as the same defect: the remainder is still the claimed node', () => {
    const plan = planFailure(fail('sitemap-url-health', [NOINDEX[0]]), [node({ state: 'in_progress', ownerSession: 'cursor-gpt-2026-10-14' })])
    expect(plan.file).toBeNull()
    expect(plan.covering).toHaveLength(1)
  })

  it('files only the failing keys no active node lists', () => {
    const extra = '/open-houses/sisters: meta robots "noindex, follow" on a sitemap URL'
    const plan = planFailure(fail('sitemap-url-health', [...NOINDEX, extra]), [node({ state: 'in_progress', ownerSession: 'a' })])
    expect(plan.covering).toHaveLength(1)
    expect(plan.uncovered).toEqual([extra])
    expect(plan.file?.fingerprint).toBe(deployFingerprint('sitemap-url-health', [extra]))
  })

  it('does not let another check\'s node cover a failure', () => {
    const other = node({ versionGap: `DEPLOY-live-seo-${fp}` })
    expect(planFailure(fail('sitemap-url-health', NOINDEX), [other]).file).not.toBeNull()
  })

  it('files a linked follow-up when the same failure comes back after its node was done', () => {
    const plan = planFailure(fail('sitemap-url-health', NOINDEX), [node({ state: 'done' })])
    expect(plan.file?.recurrence).toBe(2)
    expect(plan.file?.previous?.id).toBe('n1')
    const r2 = node({ id: 'n2', versionGap: `DEPLOY-sitemap-url-health-${fp}-r2`, state: 'done' })
    expect(planFailure(fail('sitemap-url-health', NOINDEX), [node({ state: 'done' }), r2]).file?.recurrence).toBe(3)
  })

  it('reports a killed node instead of refiling it', () => {
    const plan = planFailure(fail('sitemap-url-health', NOINDEX), [node({ state: 'killed', blockedReason: 'accepted by Matt' })])
    expect(plan.file).toBeNull()
    expect(plan.killed?.id).toBe('n1')
  })

  it('files nothing for transport errors alone', () => {
    const plan = planFailure(fail('live-seo', ['/a: fetch failed (TimeoutError)']), [])
    expect(plan.keys).toEqual([])
    expect(plan.file).toBeNull()
  })
})

describe('reconcileDeployDefects: filing', () => {
  const FIRST = run([fail('sitemap-url-health', NOINDEX)])

  it('files one claimable node and prints the exact claim command', async () => {
    const mem = memory()
    const report = await reconcileDeployDefects(FIRST, mem.ops)
    expect(mem.calls.create).toBe(1)
    expect(mem.nodes).toHaveLength(1)
    const gap = mem.nodes[0].versionGap as string
    expect(gap).toMatch(/^DEPLOY-sitemap-url-health-[0-9a-f]{10}$/)
    expect(mem.nodes[0].state).toBe('open')
    expect(report.lines).toContain(
      `Filed ${gap} (unclaimed): claim it with npx tsx --conditions=react-server scripts/deploy-defects.ts --claim ${gap} --owner <tool>-<model>-2026-10-14`,
    )
    expect(report.outcomes).toEqual([{ kind: 'filed', family: 'sitemap-url-health', gap, id: 'node-1', recurrenceOf: null }])
  })

  it('is idempotent: the same failure again, from any session, never creates a second node', async () => {
    const mem = memory()
    await reconcileDeployDefects(FIRST, mem.ops)
    const again = await reconcileDeployDefects(run([fail('sitemap-url-health', [...NOINDEX].reverse())], true, 'ffffffffffff'), mem.ops)
    expect(mem.nodes).toHaveLength(1)
    expect(mem.calls.create).toBe(1)
    const gap = mem.nodes[0].versionGap as string
    expect(again.lines.some((l) => l.startsWith(`${gap} is already filed (unclaimed): claim it with `))).toBe(true)
  })

  it('tells every later run who holds it and since when, and files nothing', async () => {
    const mem = memory()
    await reconcileDeployDefects(FIRST, mem.ops)
    await mem.ops.claim('node-1', 'claude-opus-2026-10-14')
    const gap = mem.nodes[0].versionGap as string
    const later = await reconcileDeployDefects(FIRST, mem.ops)
    expect(mem.calls.create).toBe(1)
    expect(later.lines).toContain(`${gap} is claimed by claude-opus-2026-10-14 since 2026-10-14 20:15Z: do not start a second fix`)
    expect(later.outcomes).toEqual([{ kind: 'existing', family: 'sitemap-url-health', gap, state: 'in_progress', owner: 'claude-opus-2026-10-14' }])
  })

  it('treats losing the create race as the node already being filed', async () => {
    const mem = memory()
    const racing: DeployDefectOps = {
      ...mem.ops,
      async create(draft) {
        // Another run files it between our read and our write.
        await mem.ops.create(draft)
        return mem.ops.create(draft)
      },
    }
    const report = await reconcileDeployDefects(FIRST, racing)
    expect(mem.nodes).toHaveLength(1)
    expect(report.lines.some((l) => l.includes('is already filed (unclaimed)'))).toBe(true)
    expect(report.lines.some((l) => l.startsWith('Filed '))).toBe(false)
  })

  it('files one node per distinct failing check in the same run', async () => {
    const mem = memory()
    const report = await reconcileDeployDefects(
      run([fail('sitemap-url-health', NOINDEX), fail('live-seo', ['/team: no <title>']), fail('legacy-image', ['/_next/image?url=/favicon.ico: want a 308 to /favicon.ico'])]),
      mem.ops,
    )
    expect(mem.nodes.map((n) => parseDeployGap(n.versionGap)?.family).sort()).toEqual(['legacy-image', 'live-seo', 'sitemap-url-health'])
    expect(report.lines.filter((l) => l.startsWith('Filed '))).toHaveLength(3)
  })

  it('files a recurrence as a linked follow-up when the node was done', async () => {
    const mem = memory()
    await reconcileDeployDefects(FIRST, mem.ops)
    await reconcileDeployDefects(run([{ family: 'sitemap-url-health', status: 'pass' }]), mem.ops)
    expect(mem.nodes[0].state).toBe('done')
    const report = await reconcileDeployDefects(FIRST, mem.ops)
    expect(mem.nodes).toHaveLength(2)
    expect(mem.nodes[1].versionGap).toBe(`${mem.nodes[0].versionGap}-r2`)
    expect(mem.nodes[1].parentId).toBe('node-1')
    expect(mem.nodes[1].state).toBe('open')
    expect(report.lines.some((l) => l.startsWith(`Filed ${mem.nodes[1].versionGap} (unclaimed): claim it with `))).toBe(true)
    expect(report.lines.some((l) => l.includes(`recurrence of ${mem.nodes[0].versionGap}`))).toBe(true)
  })

  it('does not refile a killed node and says so', async () => {
    const mem = memory()
    await reconcileDeployDefects(FIRST, mem.ops)
    mem.nodes[0].state = 'killed'
    mem.nodes[0].blockedReason = 'accepted: these pages are meant to be noindex'
    const report = await reconcileDeployDefects(FIRST, mem.ops)
    expect(mem.nodes).toHaveLength(1)
    expect(report.lines.some((l) => l.includes('was killed (accepted: these pages are meant to be noindex)') && l.includes('not refiled'))).toBe(true)
  })

  it('files nothing and writes nothing for transport errors alone', async () => {
    const mem = memory()
    const report = await reconcileDeployDefects(run([fail('live-seo', ['/a: fetch failed (TimeoutError)'])]), mem.ops)
    expect(mem.calls.create).toBe(0)
    expect(report.lines.join('\n')).toContain('only transport errors')
  })
})

describe('reconcileDeployDefects: never fatal', () => {
  const FIRST = run([fail('sitemap-url-health', NOINDEX)])

  it('prints the failure as not filed, writes nothing, and does not throw when the work graph cannot be read', async () => {
    const mem = memory()
    const down: DeployDefectOps = {
      ...mem.ops,
      async list() {
        throw new Error('Supabase service role not configured')
      },
    }
    const report = await reconcileDeployDefects(FIRST, down)
    expect(mem.calls.create).toBe(0)
    expect(report.outcomes).toEqual([{ kind: 'not-filed', family: 'sitemap-url-health', error: 'Supabase service role not configured' }])
    expect(report.lines.join('\n')).toContain('could not be read (Supabase service role not configured), so this failure was NOT filed')
  })

  it('reports a failed write and still does not throw', async () => {
    const mem = memory()
    const failing: DeployDefectOps = { ...mem.ops, create: async () => ({ id: null, error: 'connection reset' }) }
    const report = await reconcileDeployDefects(FIRST, failing)
    expect(report.lines.join('\n')).toContain('could not file DEPLOY-sitemap-url-health-')
    expect(report.lines.join('\n')).toContain('connection reset')
    expect(report.outcomes[0].kind).toBe('not-filed')
  })

  it('survives an op that throws mid-run', async () => {
    const mem = memory()
    const throwing: DeployDefectOps = {
      ...mem.ops,
      create: async () => {
        throw new Error('boom')
      },
    }
    const report = await reconcileDeployDefects(FIRST, throwing)
    expect(report.lines.join('\n')).toContain('deploy defect filing stopped: boom')
  })

  it('calls nothing when every check passed or was skipped and nothing is open', async () => {
    const mem = memory()
    const report = await reconcileDeployDefects(run([{ family: 'live-seo', status: 'skipped' }]), mem.ops)
    expect(report).toEqual({ lines: [], outcomes: [] })
    expect(mem.calls.list).toBe(0)
  })
})

describe('reconcileDeployDefects: --no-file', () => {
  it('reads and prints, and calls no write op', async () => {
    const mem = memory()
    await reconcileDeployDefects(run([fail('sitemap-url-health', NOINDEX)]), mem.ops)
    mem.nodes[0].state = 'in_progress'
    mem.nodes[0].ownerSession = 'cursor-gpt-2026-10-14'
    const before = { ...mem.calls, claim: [...mem.calls.claim], complete: [...mem.calls.complete] }
    const report = await reconcileDeployDefects(
      run([fail('sitemap-url-health', [...NOINDEX, '/open-houses/sisters: HTTP 404']), fail('live-seo', ['/team: no <title>']), { family: 'inline-scripts', status: 'pass' }], false),
      mem.ops,
    )
    expect(mem.calls.create).toBe(before.create)
    expect(mem.calls.claim).toEqual(before.claim)
    expect(mem.calls.complete).toEqual(before.complete)
    expect(mem.calls.release).toEqual([])
    expect(mem.nodes).toHaveLength(1)
    expect(report.lines.some((l) => l.includes('is claimed by cursor-gpt-2026-10-14'))).toBe(true)
    expect(report.lines.filter((l) => l.startsWith('Not filed (--no-file, nothing written): would file DEPLOY-'))).toHaveLength(2)
  })

  it('does not close a node on a pass', async () => {
    const mem = memory()
    await reconcileDeployDefects(run([fail('live-seo', ['/team: no <title>'])]), mem.ops)
    const report = await reconcileDeployDefects(run([{ family: 'live-seo', status: 'pass' }], false), mem.ops)
    expect(mem.nodes[0].state).toBe('open')
    expect(mem.calls.claim).toEqual([])
    expect(report.lines[0]).toMatch(/^Not closed \(--no-file, nothing written\): DEPLOY-live-seo-[0-9a-f]{10} would be completed, live SEO baseline passes$/)
  })
})

describe('reconcileDeployDefects: a pass closes the node', () => {
  async function filed(family: DeployCheckResult['family'], keys: string[]) {
    const mem = memory()
    await reconcileDeployDefects(run([fail(family, keys)]), mem.ops)
    return mem
  }

  it('completes an unclaimed node with the passing run as evidence (claim, then the existing completion)', async () => {
    const mem = await filed('inline-scripts', ['inline script #3: SyntaxError: Unexpected token }'])
    const report = await reconcileDeployDefects(
      run([{ family: 'inline-scripts', status: 'pass', evidence: '4 inline script(s) parsed of 31 <script> tag(s); 0 parse error(s)' }], true, 'abcdef0123456789'),
      mem.ops,
    )
    expect(mem.nodes[0].state).toBe('done')
    expect(mem.calls.claim).toEqual([['node-1', 'deploy-verify-abcdef0']])
    expect(mem.nodes[0].evidence).toContain('deploy:verify passed "inline scripts and GTM loader" at deploy abcdef0')
    expect(mem.nodes[0].evidence).toContain('4 inline script(s) parsed of 31')
    expect(mem.nodes[0].evidence).toContain('Closed by deploy:verify, not by a session.')
    expect(report.lines).toEqual([`${mem.nodes[0].versionGap} completed: inline scripts and GTM loader passes at abcdef0`])
  })

  it('completes a node a session holds, without taking it from them first, and says whose it was', async () => {
    const mem = await filed('inline-scripts', ['inline script #3: SyntaxError: Unexpected token }'])
    await mem.ops.claim('node-1', 'claude-opus-2026-10-14')
    mem.calls.claim.length = 0
    const report = await reconcileDeployDefects(run([{ family: 'inline-scripts', status: 'pass' }]), mem.ops)
    expect(mem.nodes[0].state).toBe('done')
    expect(mem.calls.claim).toEqual([])
    expect(report.lines[0]).toContain('(it was claimed by claude-opus-2026-10-14; the fix is live)')
  })

  it('releases the claim it took when the completion is refused', async () => {
    const mem = await filed('inline-scripts', ['inline script #3: SyntaxError: Unexpected token }'])
    const refusing: DeployDefectOps = { ...mem.ops, complete: async () => ({ ok: false, error: 'evidence is required' }) }
    const report = await reconcileDeployDefects(run([{ family: 'inline-scripts', status: 'pass' }]), refusing)
    expect(mem.calls.release).toEqual(['node-1'])
    expect(mem.nodes[0].state).toBe('open')
    expect(mem.nodes[0].ownerSession).toBeNull()
    expect(report.lines[0]).toContain('could not be closed (evidence is required); left open')
  })

  it('leaves a node open that another session claimed between our read and our claim', async () => {
    const mem = await filed('inline-scripts', ['inline script #3: SyntaxError: Unexpected token }'])
    const raced: DeployDefectOps = { ...mem.ops, claim: async () => ({ ok: false, error: 'update matched no row' }) }
    const report = await reconcileDeployDefects(run([{ family: 'inline-scripts', status: 'pass' }]), raced)
    expect(mem.nodes[0].state).toBe('open')
    expect(mem.calls.complete).toEqual([])
    expect(report.lines[0]).toContain('left open')
  })

  it('does not touch the nodes of a check that did not pass, or that was skipped', async () => {
    const mem = await filed('inline-scripts', ['inline script #3: SyntaxError: Unexpected token }'])
    await reconcileDeployDefects(run([{ family: 'live-seo', status: 'pass' }, { family: 'inline-scripts', status: 'skipped' }]), mem.ops)
    expect(mem.nodes[0].state).toBe('open')
  })

  it('on a sampled pass, closes only when each recorded URL was fetched or is gone from the sitemap', async () => {
    const mem = await filed('sitemap-url-health', NOINDEX)
    const notFetched = await reconcileDeployDefects(
      run([{ family: 'sitemap-url-health', status: 'pass', scope: { checkedPaths: ['/team'], listedPaths: ['/team', '/open-houses/bend', '/open-houses/redmond'] } }]),
      mem.ops,
    )
    expect(mem.nodes[0].state).toBe('open')
    expect(notFetched.lines[0]).toContain('passed on a sample that did not fetch 2 of the 2 URL(s) this node recorded (first: /open-houses/bend); left open')
    const verified = await reconcileDeployDefects(
      run([{ family: 'sitemap-url-health', status: 'pass', scope: { checkedPaths: ['/team', '/open-houses/bend'], listedPaths: ['/team', '/open-houses/bend'] } }]),
      mem.ops,
    )
    expect(mem.nodes[0].state).toBe('done')
    expect(verified.lines[0]).toContain('completed')
    expect(mem.nodes[0].evidence).toContain('each recorded URL was fetched this run or is gone from the sitemap')
  })

  it('verifies against paths only: an aggregate failure has no path to miss', () => {
    expect(unverifiedPaths(['listings.xml: only # of # URLs carry <image:loc> (floor #%)'], { checkedPaths: [], listedPaths: ['/x'] })).toEqual([])
    expect(unverifiedPaths(['/x: HTTP 404'], undefined)).toEqual([])
    expect(unverifiedPaths(['/x: HTTP 404', '/y: HTTP 404'], { checkedPaths: ['/y'], listedPaths: ['/x', '/y'] })).toEqual(['/x'])
  })
})

describe('the boot brief block', () => {
  const view = (over: Partial<DeployNodeView> & Pick<DeployNodeView, 'versionGap' | 'state'>): DeployNodeView => ({
    id: over.versionGap ?? 'x',
    title: 'Deploy check failed: sitemap URL health (2 failures)',
    objective: 'Found at deploy 1a2b3c4 on 2026-10-14T20:11:00.000Z.\n',
    ownerSession: null,
    blockedReason: null,
    evidence: null,
    updatedAt: '2026-10-14T20:15:00.000Z',
    ...over,
  })
  const NOW = new Date('2026-10-14T21:00:00.000Z')

  it('says none are open', () => {
    const lines = formatDeployDefectBrief([view({ versionGap: 'SITE-1', state: 'open' }), view({ versionGap: 'DEPLOY-live-seo-0123456789', state: 'done' })], NOW)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('DEPLOY-FOUND DEFECTS')
    expect(lines[1]).toMatch(/^none open/)
  })

  it('lists each open node with its claim state, unclaimed first', () => {
    const lines = formatDeployDefectBrief(
      [
        view({ versionGap: 'DEPLOY-live-seo-aaaaaaaaaa', state: 'in_progress', ownerSession: 'cursor-gpt-2026-10-14' }),
        view({ versionGap: 'DEPLOY-sitemap-smoke-bbbbbbbbbb', state: 'open' }),
      ],
      NOW,
    )
    expect(lines[1]).toContain('DEPLOY-sitemap-smoke-bbbbbbbbbb [open]')
    expect(lines[1]).toContain('found at 1a2b3c4, 2026-10-14 20:11Z')
    expect(lines[2]).toBe(
      '    UNCLAIMED. Claim it: npx tsx --conditions=react-server scripts/deploy-defects.ts --claim DEPLOY-sitemap-smoke-bbbbbbbbbb --owner <tool>-<model>-2026-10-14',
    )
    expect(lines[3]).toContain('DEPLOY-live-seo-aaaaaaaaaa [in_progress]')
    expect(lines[4]).toBe('    claimed by cursor-gpt-2026-10-14 since 2026-10-14 20:15Z: do not start a second fix')
  })

  it('names a terminal node by its state and never offers it for claiming', () => {
    expect(existingNodeLine(view({ versionGap: 'DEPLOY-live-seo-0123456789', state: 'done' }), NOW)).toBe('DEPLOY-live-seo-0123456789 is done')
    expect(existingNodeLine(view({ versionGap: 'DEPLOY-live-seo-0123456789', state: 'killed' }), NOW)).toBe('DEPLOY-live-seo-0123456789 is killed')
    expect(existingNodeLine(view({ versionGap: 'DEPLOY-live-seo-0123456789', state: 'blocked', blockedReason: 'waits on Matt' }), NOW)).toBe(
      'DEPLOY-live-seo-0123456789 is blocked (waits on Matt): do not start a second fix',
    )
  })

  it('keeps every check family a label and a reproduce command', () => {
    for (const [family, meta] of Object.entries(DEPLOY_CHECK_FAMILIES)) {
      expect(meta.label, family).toBeTruthy()
      expect(meta.reproduce, family).toMatch(/^npm run /)
    }
    expect(deployClaimCommand('DEPLOY-x', new Date('2026-10-14T00:00:00Z'))).toContain('--owner <tool>-<model>-2026-10-14')
  })
})
