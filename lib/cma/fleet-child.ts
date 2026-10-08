/**
 * One child process for the CMA fleet dry run (scripts/cma-fleet-dryrun.ts),
 * run as its own process group so every kill reaches the whole tree.
 *
 * Why a group (2026-10-07 review): the fleet spawns `tsx <script>`, and tsx is
 * a wrapper that runs the engine in a grandchild node process sharing our
 * stdout and stderr pipes (esbuild's service process holds stderr too). A
 * SIGKILL to the wrapper alone leaves the grandchild alive and re-parented,
 * still holding the pipes, so 'close' never fires and the worker slot waits
 * forever. Verified with tsx 4.23.13: wrapper-only SIGKILL, grandchild still
 * alive and no 'close' two seconds later; group SIGKILL, both gone and
 * 'close' at once.
 *
 * So: `detached: true` makes the child a process-group leader (setsid on
 * POSIX), and every signal goes to `-pid`, the whole group. ESRCH (the group
 * is already gone) is ignored. The child is never unref'd: its pipes keep the
 * parent's event loop alive until the outcome resolves.
 *
 * The outcome resolves on 'close' (exit plus every pipe drained). If the
 * wrapper exits and 'close' has not followed within drainMs, something outside
 * the group still holds the pipes; the group gets SIGKILL, the streams are
 * destroyed, and the outcome resolves anyway with pipesHeld set. A slot can
 * never hang: spawn errors resolve, timeouts escalate SIGTERM -> SIGKILL on
 * the group, an exit always starts the drain timer.
 *
 * Decisions about what an outcome means (harness reason, scoring) live in the
 * pure lib/cma/fleet-score.ts; this module only runs the process.
 */
import { spawn } from 'node:child_process'

export type GroupChildOutcome = {
  stdout: string
  stderr: string
  /** The wrapper's exit code, null when a signal ended it or it never spawned. */
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  /** A stream passed stdioCap; the group was SIGKILLed and the rest discarded. */
  overflow: boolean
  /** The wrapper exited but the pipes stayed open past drainMs; the group was SIGKILLed. */
  pipesHeld: boolean
  spawnError: string | null
  durationMs: number
}

export type GroupChildOptions = {
  command: string
  args: readonly string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  timeoutMs: number
  /** SIGTERM first; SIGKILL to the group this long after a timeout. */
  killGraceMs: number
  /** Per-stream byte cap. */
  stdioCap: number
  /** How long after the wrapper exits 'close' may take before the group is killed and the outcome resolves. */
  drainMs: number
}

export type GroupChild = {
  /** The group id (the leader's pid); null when spawn failed. */
  pid: number | null
  done: Promise<GroupChildOutcome>
  /** Signals the whole group. A no-op once the outcome has resolved; never throws. */
  signal: (sig: NodeJS.Signals) => void
}

/**
 * kill(-pid, sig): 'sent', 'gone' when no process is left in the group
 * (ESRCH, ignored), 'failed' for anything else (the caller may fall back to
 * the leader alone).
 */
export function signalGroup(pid: number, sig: NodeJS.Signals): 'sent' | 'gone' | 'failed' {
  if (!Number.isInteger(pid) || pid <= 1) return 'failed'
  try {
    process.kill(-pid, sig)
    return 'sent'
  } catch (e) {
    return (e as NodeJS.ErrnoException)?.code === 'ESRCH' ? 'gone' : 'failed'
  }
}

export function startGroupChild(opts: GroupChildOptions): GroupChild {
  const started = Date.now()
  const child = spawn(opts.command, [...opts.args], {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group, so -pid reaches the grandchild. Never unref'd.
    detached: true,
  })
  const pid = typeof child.pid === 'number' ? child.pid : null

  const out: Buffer[] = []
  const err: Buffer[] = []
  const outLen = { n: 0 }
  const errLen = { n: 0 }
  let overflow = false
  let timedOut = false
  let pipesHeld = false
  let settled = false
  let spawnError: string | null = null
  let exitCode: number | null = null
  let exitSignal: string | null = null
  let graceTimer: NodeJS.Timeout | null = null
  let drainTimer: NodeJS.Timeout | null = null

  const signal = (sig: NodeJS.Signals) => {
    if (settled || pid == null) return
    if (signalGroup(pid, sig) === 'failed') {
      try {
        child.kill(sig)
      } catch {
        /* already gone */
      }
    }
  }

  let resolveDone!: (o: GroupChildOutcome) => void
  const done = new Promise<GroupChildOutcome>((resolve) => {
    resolveDone = resolve
  })

  const finish = () => {
    if (settled) return
    // Reap anything in the group that outlived the wrapper without holding
    // the pipes; ESRCH (the usual case: nothing left) is ignored.
    if (pid != null && spawnError == null) signalGroup(pid, 'SIGKILL')
    settled = true
    clearTimeout(timeoutTimer)
    if (graceTimer) clearTimeout(graceTimer)
    if (drainTimer) clearTimeout(drainTimer)
    resolveDone({
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8'),
      exitCode,
      signal: exitSignal,
      timedOut,
      overflow,
      pipesHeld,
      spawnError,
      durationMs: Date.now() - started,
    })
  }

  const timeoutTimer = setTimeout(() => {
    timedOut = true
    signal('SIGTERM')
    graceTimer = setTimeout(() => signal('SIGKILL'), opts.killGraceMs)
  }, opts.timeoutMs)

  const collect = (bufs: Buffer[], len: { n: number }, chunk: Buffer) => {
    if (overflow) return
    len.n += chunk.length
    if (len.n > opts.stdioCap) {
      overflow = true
      signal('SIGKILL')
      return
    }
    bufs.push(chunk)
  }
  child.stdout?.on('data', (chunk: Buffer) => collect(out, outLen, chunk))
  child.stderr?.on('data', (chunk: Buffer) => collect(err, errLen, chunk))
  // A destroyed or broken pipe must not throw out of the parent.
  child.stdout?.on('error', () => {})
  child.stderr?.on('error', () => {})

  child.on('error', (e) => {
    // 'error' without a pid is a spawn failure; with one, a failed kill or
    // send, which the group signal already covers.
    if (pid != null) return
    spawnError = e.message
    finish()
  })
  child.on('exit', (code, sig) => {
    exitCode = code
    exitSignal = sig
    drainTimer = setTimeout(() => {
      pipesHeld = true
      signal('SIGKILL')
      child.stdout?.destroy()
      child.stderr?.destroy()
      finish()
    }, opts.drainMs)
  })
  child.on('close', (code, sig) => {
    if (exitCode == null && exitSignal == null) {
      exitCode = code
      exitSignal = sig
    }
    finish()
  })

  return { pid, done, signal }
}
