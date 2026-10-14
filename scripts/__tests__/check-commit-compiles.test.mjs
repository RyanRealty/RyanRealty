import { afterEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HEAVY_SH,
  DEFAULT_TIMEOUT_MS,
  KILL_GRACE_MS,
  COMMIT_CHECK_TMP_PREFIX,
  resolveTscCommand,
  parseTimeoutMs,
  childStillRunning,
  killProcessGroup,
  spawnDetachedSigkill,
  cleanupCommitCheckDir,
  reapCommitCheckChild,
  runTscDetached,
} from '../check-commit-compiles.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-commit-compiles.mjs')
const SOURCE = readFileSync(GATE, 'utf8')

const tmpDirs = []
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveTscCommand', () => {
  const tsconfigPath = '/tmp/rr-commit-check-x/tsconfig.check.json'
  const npxBin = '/usr/bin/npx'

  it('wraps tsc in heavy.sh when the wrapper exists', () => {
    expect(resolveTscCommand({ npxBin, tsconfigPath, heavyShExists: true })).toEqual({
      command: HEAVY_SH,
      args: [npxBin, 'tsc', '--noEmit', '-p', tsconfigPath],
    })
  })

  it('runs tsc directly when heavy.sh is absent', () => {
    expect(resolveTscCommand({ npxBin, tsconfigPath, heavyShExists: false })).toEqual({
      command: npxBin,
      args: ['tsc', '--noEmit', '-p', tsconfigPath],
    })
  })
})

describe('parseTimeoutMs', () => {
  it('defaults to about 10 minutes', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10 * 60 * 1000)
    expect(parseTimeoutMs({})).toBe(DEFAULT_TIMEOUT_MS)
    expect(parseTimeoutMs({ COMMIT_COMPILES_TIMEOUT_MS: '' })).toBe(DEFAULT_TIMEOUT_MS)
    expect(parseTimeoutMs({ COMMIT_COMPILES_TIMEOUT_MS: 'nope' })).toBe(DEFAULT_TIMEOUT_MS)
  })

  it('honors COMMIT_COMPILES_TIMEOUT_MS', () => {
    expect(parseTimeoutMs({ COMMIT_COMPILES_TIMEOUT_MS: '1500' })).toBe(1500)
  })
})

describe('process-tree reap', () => {
  it('SIGTERMs the group, then a detached SIGKILL after the grace period', () => {
    const kills = []
    const spawned = []
    reapCommitCheckChild(4242, '/tmp/rr-commit-check-fake', {
      kill: (pid, sig) => { kills.push([pid, sig]) },
      spawnFn: (cmd, args, opts) => {
        spawned.push({ cmd, args, opts })
        return { unref() {} }
      },
      execPath: '/usr/bin/node',
      graceMs: 5000,
      rmSync: () => {},
    })
    expect(kills).toEqual([[-4242, 'SIGTERM']])
    expect(spawned).toHaveLength(1)
    expect(spawned[0].opts).toEqual({ detached: true, stdio: 'ignore' })
    expect(spawned[0].args[1]).toContain("process.kill(-4242,'SIGKILL')")
    expect(spawned[0].args[1]).toContain('5000')
  })

  it('kills a live detached child with SIGTERM then SIGKILL', async () => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' })
    const pid = child.pid
    expect(pid).toBeGreaterThan(0)
    process.kill(pid, 0)
    killProcessGroup(pid)
    spawnDetachedSigkill(pid, { graceMs: 80 })
    await new Promise((r) => setTimeout(r, 250))
    expect(() => process.kill(pid, 0)).toThrow()
    expect(childStillRunning(child)).toBe(false)
  })

  it('rmSyncs the /tmp/rr-commit-check-* dir recursively', () => {
    const dir = mkdtempSync(join(tmpdir(), COMMIT_CHECK_TMP_PREFIX))
    tmpDirs.push(dir)
    writeFileSync(join(dir, 'keep'), 'x')
    cleanupCommitCheckDir(dir)
    expect(existsSync(dir)).toBe(false)
  })
})

describe('runTscDetached', () => {
  it('spawns detached and keeps a child reference', async () => {
    let seen = null
    const result = await runTscDetached({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("ok")'],
      cwd: REPO,
      env: process.env,
      timeoutMs: 10_000,
      onSpawn: (child) => { seen = child },
    })
    expect(seen?.pid).toBeGreaterThan(0)
    expect(result.status).toBe(0)
    expect(result.timedOut).toBe(false)
    expect(result.stdout).toContain('ok')
  })

  it('times out, kills the tree, and reports timedOut', async () => {
    const reaps = []
    const result = await runTscDetached({
      command: 'sleep',
      args: ['30'],
      cwd: REPO,
      env: process.env,
      timeoutMs: 80,
      graceMs: 40,
      reap: (pid, dir) => {
        reaps.push({ pid, dir })
        try { process.kill(-pid, 'SIGTERM') } catch { /* already gone */ }
        spawnDetachedSigkill(pid, { graceMs: 40 })
      },
    })
    expect(result.timedOut).toBe(true)
    expect(reaps).toHaveLength(1)
    expect(reaps[0].pid).toBeGreaterThan(0)
    expect(result.error?.code).toBe('ETIMEDOUT')
  })
})

describe('G46 source contract', () => {
  it('traps exit, SIGINT, SIGTERM, uncaughtException and unhandledRejection', () => {
    for (const ev of ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection']) {
      expect(SOURCE).toContain(`process.on('${ev}'`)
    }
    expect(SOURCE).toContain('process.kill(-pid, \'SIGTERM\')')
    expect(SOURCE).toContain('SIGKILL')
    expect(SOURCE).toContain('detached: true')
    expect(SOURCE).toContain(HEAVY_SH)
    expect(SOURCE).toContain('COMMIT_COMPILES_TIMEOUT_MS')
    expect(SOURCE).toContain("COMMIT IS SELF-CONTAINED")
    expect(SOURCE).toContain("COMMIT IS NOT SELF-CONTAINED")
  })
})
