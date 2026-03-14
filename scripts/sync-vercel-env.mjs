#!/usr/bin/env node
/**
 * Push env vars from .env.local to Vercel (Production).
 * Uses npx vercel so you don't need the CLI installed globally.
 * Run "npx vercel link" once and "npx vercel login" if needed.
 *
 * Usage: node scripts/sync-vercel-env.mjs [environment]
 *   environment: production (default) or preview
 *
 * On Windows PowerShell, if terminal re-executes output as commands, run from
 * Command Prompt instead: cmd /c "npm run vercel:env"
 */

import { createWriteStream, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { spawn } from 'child_process'

const LOG_PATH = resolve(process.cwd(), '.vercel-env-sync.log')
const logStream = createWriteStream(LOG_PATH, { flags: 'w' })
function log(msg) {
  const line = `[vercel:env] ${msg}\n`
  logStream.write(line)
}
function logErr(msg) {
  const line = `[vercel:env] ${msg}\n`
  logStream.write(line)
}
function out(msg) {
  process.stdout.write(msg + '\n')
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (val.startsWith('"') && val.endsWith('"'))
        val = val.slice(1, -1).replace(/\\n/g, '\n')
      else if (val.startsWith("'") && val.endsWith("'"))
        val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch (e) {
    out('vercel:env ERROR: Could not read .env.local - ' + e.message)
    process.exit(1)
  }
}

const isWin = process.platform === 'win32'

// Suppress DEP0190 from Vercel CLI (it spawns children with shell: true)
const baseNodeOpts = (process.env.NODE_OPTIONS || '').trim()
const spawnEnv = { ...process.env, NODE_OPTIONS: baseNodeOpts ? `${baseNodeOpts} --no-deprecation` : '--no-deprecation' }

// Escape key for cmd.exe (used only on Windows). Safe keys stay as-is.
function escapeKeyForCmd(key) {
  return /^[A-Za-z0-9_]+$/.test(key) ? key : `"${key.replace(/"/g, '""')}"`
}

// Pipe child stdout/stderr to log file so PowerShell does not re-execute them
function runVercel(cmdArgs) {
  return new Promise((resolvePromise, reject) => {
    const opts = { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: spawnEnv }
    const proc = isWin
      ? spawn('cmd.exe', ['/c', 'npx vercel ' + cmdArgs.map((a) => escapeKeyForCmd(a)).join(' ')], opts)
      : spawn('npx', ['vercel', ...cmdArgs], { ...opts, shell: false })
    proc.stdout?.on('data', (c) => logStream.write(c))
    proc.stderr?.on('data', (c) => logStream.write(c))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolvePromise() : reject(new Error(`exit ${code}`))))
  })
}

// Remove var from all environments so we can re-add (fixes "already exists" / "branch undefined"). Ignore errors.
function runVercelEnvRm(key) {
  return runVercel(['env', 'rm', key, '--yes']).catch(() => {})
}

function runVercelEnvAdd(key, value, environment) {
  return new Promise((resolvePromise, reject) => {
    const opts = { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: spawnEnv }
    const proc = isWin
      ? spawn('cmd.exe', ['/c', 'npx vercel env add ' + escapeKeyForCmd(key) + ' ' + environment], opts)
      : spawn('npx', ['vercel', 'env', 'add', key, environment], { ...opts, shell: false })
    proc.stdout?.on('data', (c) => logStream.write(c))
    proc.stderr?.on('data', (c) => logStream.write(c))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolvePromise() : reject(new Error(`exit ${code}`))))
    proc.stdin.write(value, (err) => {
      if (err) reject(err)
      else proc.stdin.end()
    })
  })
}

const environment = process.argv[2] === 'preview' ? 'preview' : 'production'
const env = loadEnvLocal()
const keys = Object.keys(env).filter((k) => env[k] !== '')

const vercelProjectJson = resolve(process.cwd(), '.vercel', 'project.json')
if (!existsSync(vercelProjectJson)) {
  out('vercel:env ERROR: Not linked. Run: npx vercel link')
  process.exit(1)
}

log(`Syncing ${keys.length} variables to Vercel (${environment})...`)
let done = 0
for (const key of keys) {
  try {
    await runVercelEnvRm(key)
    await runVercelEnvAdd(key, env[key], environment)
    done++
    log(key)
  } catch (e) {
    logErr(`${key} failed: ${e.message}`)
  }
}
logStream.end()
out(`Done: ${done}/${keys.length} env vars synced to Vercel. See .vercel-env-sync.log for details.`)
