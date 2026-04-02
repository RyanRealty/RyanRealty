#!/usr/bin/env node
/**
 * Cross-platform dev server entry.
 * Windows: delegates to run-dev.ps1 (port cleanup, lock, next dev).
 * macOS/Linux: frees port 3000, removes .next/dev/lock, runs next dev.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const psScript = join(__dirname, 'run-dev.ps1')

function freePort3000Unix() {
  try {
    const out = execFileSync('lsof', ['-ti', ':3000'], { encoding: 'utf8' })
    const pids = [...new Set(out.trim().split(/\s+/).filter(Boolean))]
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGTERM')
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no listener on 3000 */
  }
}

function removeDevLock() {
  const lockPath = join(root, '.next', 'dev', 'lock')
  if (existsSync(lockPath)) {
    try {
      unlinkSync(lockPath)
    } catch {
      /* ignore */
    }
  }
}

if (process.platform === 'win32') {
  const child = spawn(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', psScript],
    { stdio: 'inherit', cwd: root, shell: false },
  )
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
} else {
  freePort3000Unix()
  await new Promise((r) => setTimeout(r, 500))
  removeDevLock()

  const child = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    cwd: root,
    shell: false,
  })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
}
