import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { signalGroup, startGroupChild, type GroupChildOptions } from '@/lib/cma/fleet-child'

// Each case runs a fake `tsx`: a node wrapper that starts a grandchild sharing
// our pipes, which is the shape that hung the fleet when only the wrapper was
// killed. The grandchild prints nothing; the wrapper prints its pid.

const NODE = process.execPath
const strays: number[] = []

function opts(code: string, over: Partial<GroupChildOptions> = {}): GroupChildOptions {
  return {
    command: NODE,
    args: ['-e', code],
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 30_000,
    killGraceMs: 300,
    stdioCap: 1024 * 1024,
    drainMs: 5_000,
    ...over,
  }
}

/** Alive and not a zombie (PID 1 in a container may never reap one). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z'
  } catch {
    return true
  }
}

async function deadWithin(pid: number, ms: number): Promise<boolean> {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (!alive(pid)) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return !alive(pid)
}

function grandchildPid(stdout: string): number {
  const m = /grandchild (\d+)/.exec(stdout)
  if (!m) throw new Error(`no grandchild pid in ${JSON.stringify(stdout)}`)
  const pid = Number(m[1])
  strays.push(pid)
  return pid
}

afterEach(() => {
  for (const pid of strays.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* gone */
    }
  }
})

// The wrapper and its grandchild both ignore SIGTERM, so only a group SIGKILL ends them.
const STUBBORN_WRAPPER = `
const { spawn } = require('node:child_process')
process.on('SIGTERM', () => {})
const g = spawn('sh', ['-c', 'trap "" TERM; exec sleep 300'], { stdio: 'inherit' })
process.stdout.write('grandchild ' + g.pid + '\\n')
setInterval(() => {}, 1000)
`

describe('startGroupChild', () => {
  it('collects stdout and stderr and the exit code of a normal child', async () => {
    const c = startGroupChild(opts(`process.stdout.write('[\\n]\\n'); process.stderr.write('note\\n')`))
    const o = await c.done
    expect(o).toMatchObject({ stdout: '[\n]\n', stderr: 'note\n', exitCode: 0, signal: null, timedOut: false, overflow: false, pipesHeld: false, spawnError: null })
    expect(() => c.signal('SIGKILL')).not.toThrow()
  })

  it('a spawn failure resolves with the error instead of hanging', async () => {
    const o = await startGroupChild(opts('', { command: '/nonexistent/fleet-child-test-binary', args: [] })).done
    expect(o.spawnError).toMatch(/ENOENT/)
    expect(o.timedOut).toBe(false)
  })

  it('timeout: SIGTERM then SIGKILL to the whole group reaches the grandchild holding the pipes', async () => {
    const started = Date.now()
    const o = await startGroupChild(opts(STUBBORN_WRAPPER, { timeoutMs: 600, killGraceMs: 300, drainMs: 10_000 })).done
    const gpid = grandchildPid(o.stdout)
    expect(o.timedOut).toBe(true)
    expect(o.signal).toBe('SIGKILL')
    // Resolved on 'close' from the group kill, not on the 10 s drain timer.
    expect(o.pipesHeld).toBe(false)
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(await deadWithin(gpid, 2_000)).toBe(true)
  }, 20_000)

  it('overflow: a grandchild flooding stdout is SIGKILLed with its wrapper and the outcome resolves', async () => {
    const flood = `
const { spawn } = require('node:child_process')
const g = spawn(process.execPath, ['-e', "const b = Buffer.alloc(65536, 120); const w = () => { while (process.stdout.write(b)) {} process.stdout.once('drain', w) }; w()"], { stdio: 'inherit' })
process.stderr.write('grandchild ' + g.pid + '\\n')
setInterval(() => {}, 1000)
`
    const started = Date.now()
    const o = await startGroupChild(opts(flood, { stdioCap: 256 * 1024, drainMs: 10_000 })).done
    const gpid = grandchildPid(o.stderr)
    expect(o.overflow).toBe(true)
    expect(o.signal).toBe('SIGKILL')
    expect(Buffer.byteLength(o.stdout)).toBeLessThanOrEqual(256 * 1024)
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(await deadWithin(gpid, 2_000)).toBe(true)
  }, 20_000)

  it('drain: the wrapper exits but a process outside the group holds the pipes; the outcome resolves anyway', async () => {
    // detached in the wrapper puts the grandchild in a new session, out of reach of the group kill.
    const escapee = `
const { spawn } = require('node:child_process')
const g = spawn('sleep', ['300'], { stdio: 'inherit', detached: true })
process.stdout.write('grandchild ' + g.pid + '\\n')
process.exit(0)
`
    const started = Date.now()
    const o = await startGroupChild(opts(escapee, { drainMs: 400 })).done
    const gpid = grandchildPid(o.stdout)
    expect(o.exitCode).toBe(0)
    expect(o.pipesHeld).toBe(true)
    expect(o.timedOut).toBe(false)
    expect(Date.now() - started).toBeLessThan(5_000)
    // Still alive: it left the group, which is exactly why the drain timer exists.
    expect(alive(gpid)).toBe(true)
  }, 20_000)
})

describe('signalGroup', () => {
  it('a group that is gone reads as gone (ESRCH ignored), never a throw', () => {
    const r = spawnSync(NODE, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' })
    const pid = Number(r.stdout)
    expect(pid).toBeGreaterThan(1)
    expect(signalGroup(pid, 'SIGTERM')).toBe('gone')
    expect(signalGroup(0, 'SIGTERM')).toBe('failed')
  })
})
