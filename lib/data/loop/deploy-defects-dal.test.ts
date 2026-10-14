import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The work-graph DAL is mocked whole: this suite never reaches a database, and what
// it proves is that deploy-defect filing goes THROUGH the DAL and nowhere else.
vi.mock('./work-graph', () => ({
  claimWorkNode: vi.fn(),
  completeWorkNode: vi.fn(),
  createWorkNode: vi.fn(),
  readWorkNodesByGap: vi.fn(),
  releaseWorkNode: vi.fn(),
}))

import * as graph from './work-graph'
import { deployDefectOps } from './deploy-defects-dal'
import { buildDeployDraft, deployFingerprint, reconcileDeployDefects, type DeployCheckResult } from './deploy-defects'

const m = vi.mocked(graph)

const row = (over: Record<string, unknown> = {}) => ({
  id: 'uuid-1',
  parentId: null,
  dependsOn: [],
  domain: 'factory',
  versionGap: 'DEPLOY-live-seo-0123456789',
  title: 'Deploy check failed: live SEO baseline (1 failure)',
  objective: 'Failing (1):\n- /team: no <title>\n',
  output: 'o',
  accept: 'a',
  state: 'open',
  evidence: null,
  blockedReason: null,
  ownerSession: null,
  ledgerRowId: null,
  createdAt: '2026-10-14T20:00:00.000Z',
  updatedAt: '2026-10-14T20:00:00.000Z',
  ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('deploy-defect ops are the work-graph DAL', () => {
  it('reads every DEPLOY- node through readWorkNodesByGap and throws when the read fails, so "none" is never a guess', async () => {
    m.readWorkNodesByGap.mockResolvedValueOnce({ data: [row()] as never, error: null })
    expect(await deployDefectOps().list()).toHaveLength(1)
    expect(m.readWorkNodesByGap).toHaveBeenCalledWith('DEPLOY-')
    m.readWorkNodesByGap.mockResolvedValueOnce({ data: null, error: 'permission denied' })
    await expect(deployDefectOps().list()).rejects.toThrow('permission denied')
  })

  it('files with createWorkNode, claims with claimWorkNode, completes with completeWorkNode, releases with releaseWorkNode', async () => {
    const ops = deployDefectOps()
    const draft = buildDeployDraft({ family: 'live-seo', keys: ['/team: no <title>'], sha: 'a'.repeat(40), at: '2026-10-14T20:00:00.000Z', fingerprint: '0123456789', recurrence: 1 })
    m.createWorkNode.mockResolvedValueOnce({ data: { id: 'uuid-9' }, error: null })
    expect(await ops.create(draft)).toEqual({ id: 'uuid-9', error: null })
    expect(m.createWorkNode).toHaveBeenCalledWith(draft)

    m.claimWorkNode.mockResolvedValueOnce({ data: { id: 'uuid-9' }, error: null })
    expect(await ops.claim('uuid-9', 'deploy-verify-aaaaaaa')).toEqual({ ok: true, error: null })
    expect(m.claimWorkNode).toHaveBeenCalledWith('uuid-9', 'deploy-verify-aaaaaaa')

    m.claimWorkNode.mockResolvedValueOnce({ data: null, error: 'update matched no row' })
    expect(await ops.claim('uuid-9', 'x')).toEqual({ ok: false, error: 'update matched no row' })

    m.completeWorkNode.mockResolvedValueOnce({ data: { id: 'uuid-9' }, error: null })
    expect(await ops.complete('uuid-9', 'deploy:verify passed')).toEqual({ ok: true, error: null })
    expect(m.completeWorkNode).toHaveBeenCalledWith({ id: 'uuid-9', evidence: 'deploy:verify passed' })

    m.releaseWorkNode.mockResolvedValueOnce({ data: { id: 'uuid-9' }, error: null })
    expect(await ops.release('uuid-9')).toEqual({ ok: true, error: null })
    expect(m.releaseWorkNode).toHaveBeenCalledWith('uuid-9')
  })

  it('a deploy:verify run files through createWorkNode exactly once, and a second run reads the node instead of writing', async () => {
    const results: DeployCheckResult[] = [{ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] }]
    const run = { sha: 'b'.repeat(40), at: '2026-10-14T20:00:00.000Z', write: true, results }
    m.readWorkNodesByGap.mockResolvedValueOnce({ data: [], error: null })
    m.createWorkNode.mockResolvedValueOnce({ data: { id: 'uuid-1' }, error: null })
    const first = await reconcileDeployDefects(run, deployDefectOps())
    expect(m.createWorkNode).toHaveBeenCalledTimes(1)
    const filedDraft = m.createWorkNode.mock.calls[0][0]
    expect(filedDraft.domain).toBe('factory')
    expect(filedDraft.versionGap).toBe(`DEPLOY-live-seo-${deployFingerprint('live-seo', ['/team: no <title>'])}`)
    expect(first.lines.some((l) => l.startsWith(`Filed ${filedDraft.versionGap} (unclaimed): claim it with `))).toBe(true)

    // The graph now holds that node, claimed by a session.
    m.readWorkNodesByGap.mockResolvedValueOnce({
      data: [row({ versionGap: filedDraft.versionGap, objective: filedDraft.objective, state: 'in_progress', ownerSession: 'claude-opus-2026-10-14', updatedAt: '2026-10-14T20:05:00.000Z' })] as never,
      error: null,
    })
    const second = await reconcileDeployDefects(run, deployDefectOps())
    expect(m.createWorkNode).toHaveBeenCalledTimes(1)
    expect(m.claimWorkNode).not.toHaveBeenCalled()
    expect(second.lines).toContain(`${filedDraft.versionGap} is claimed by claude-opus-2026-10-14 since 2026-10-14 20:05Z: do not start a second fix`)
  })

  it('--no-file reads the graph and calls no write function', async () => {
    m.readWorkNodesByGap.mockResolvedValueOnce({ data: [], error: null })
    await reconcileDeployDefects(
      { sha: 'c'.repeat(40), at: '2026-10-14T20:00:00.000Z', write: false, results: [{ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] }] },
      deployDefectOps(),
    )
    expect(m.createWorkNode).not.toHaveBeenCalled()
    expect(m.claimWorkNode).not.toHaveBeenCalled()
    expect(m.completeWorkNode).not.toHaveBeenCalled()
    expect(m.releaseWorkNode).not.toHaveBeenCalled()
  })

  it('an unreachable work graph prints the failure as not filed and does not throw', async () => {
    m.readWorkNodesByGap.mockResolvedValueOnce({ data: null, error: 'fetch failed' })
    const report = await reconcileDeployDefects(
      { sha: 'd'.repeat(40), at: '2026-10-14T20:00:00.000Z', write: true, results: [{ family: 'live-seo', status: 'fail', keys: ['/team: no <title>'] }] },
      deployDefectOps(),
    )
    expect(m.createWorkNode).not.toHaveBeenCalled()
    expect(report.lines.join('\n')).toContain('NOT filed')
  })
})

describe('no raw table access', () => {
  it.each(['deploy-defects.ts', 'deploy-defects-dal.ts'])('%s never calls .from() or builds a client', (file) => {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
    expect(src).not.toMatch(/\.from\(/)
    expect(src).not.toMatch(/createServiceClient|createClient\(/)
  })
})
