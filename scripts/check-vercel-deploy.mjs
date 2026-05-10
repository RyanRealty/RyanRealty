#!/usr/bin/env node
/**
 * Verify the production Vercel deploy for the current HEAD commit.
 *
 * Why this exists: between 2026-04-15 and 2026-04-21, every production
 * deploy errored because of a partial-commit (lib/tiktok.ts left untracked).
 * `git push` succeeded silently while Vercel rejected each build. Two weeks
 * of "shipped" work never reached production. The fix is to never trust the
 * push alone — verify the deploy reaches READY for the SHA you just pushed.
 *
 * Usage:
 *   node scripts/check-vercel-deploy.mjs                 # check HEAD SHA
 *   node scripts/check-vercel-deploy.mjs <commitSha>     # check a specific SHA
 *   npm run deploy:verify                                # alias
 *
 * Behavior:
 *   - Polls Vercel API for the production deployment matching the SHA.
 *   - Waits up to 5 minutes for the state to become READY or ERROR.
 *   - On ERROR: fetches the last build-log lines and prints them.
 *   - Exit codes: 0 = READY, 1 = ERROR, 2 = TIMEOUT/missing-config.
 *
 * Setup (one-time):
 *   - VERCEL_TOKEN in .env.local or shell env (https://vercel.com/account/tokens).
 *   - .vercel/project.json present (`npx vercel link` once).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { homedir } from 'os'

const TIMEOUT_MS = Number(process.env.DEPLOY_VERIFY_TIMEOUT_MS ?? 5 * 60 * 1000)
const POLL_INTERVAL_MS = Number(process.env.DEPLOY_VERIFY_POLL_MS ?? 8000)

const argv = process.argv.slice(2)
const targetSha = argv[0] && /^[0-9a-f]{7,40}$/.test(argv[0]) ? argv[0] : null

function out(msg) {
  process.stdout.write(`[deploy:verify] ${msg}\n`)
}
function err(msg) {
  process.stderr.write(`[deploy:verify] ${msg}\n`)
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return {}
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
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\n/g, '\n')
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

function loadVercelCliToken() {
  const explicitPath = process.env.VERCEL_AUTH_CONFIG?.trim()
  const authPath = explicitPath || resolve(homedir(), '.vercel/auth.json')
  if (!existsSync(authPath)) return ''
  try {
    const raw = JSON.parse(readFileSync(authPath, 'utf8'))
    return String(raw?.token ?? '').trim()
  } catch {
    return ''
  }
}

function parseJsonFromOutput(raw) {
  const firstBrace = raw.indexOf('{')
  if (firstBrace < 0) return null
  try {
    return JSON.parse(raw.slice(firstBrace))
  } catch {
    return null
  }
}

function findDeploymentForShaViaCli(sha) {
  try {
    const output = execSync(
      `npx vercel ls --environment production --meta githubCommitSha=${sha} --format json`,
      { encoding: 'utf8' },
    )
    const parsed = parseJsonFromOutput(output)
    const deployments = parsed?.deployments
    if (!Array.isArray(deployments) || deployments.length === 0) return null
    const hit = deployments[0]
    return {
      id: `cli-${sha.slice(0, 7)}`,
      state: String(hit?.state ?? 'UNKNOWN').toUpperCase(),
      url: hit?.url,
      inspectorUrl: null,
      meta: { githubCommitSha: hit?.meta?.githubCommitSha ?? sha },
    }
  } catch {
    return null
  }
}

function loadProjectMeta() {
  const path = resolve(process.cwd(), '.vercel/project.json')
  if (!existsSync(path)) {
    err('Missing .vercel/project.json. Run `npx vercel link` once to create it.')
    process.exit(2)
  }
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  if (!raw.projectId || !raw.orgId) {
    err('.vercel/project.json missing projectId or orgId.')
    process.exit(2)
  }
  return { projectId: raw.projectId, teamId: raw.orgId }
}

function getHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    err('Could not read HEAD commit SHA. Are you inside a git repo?')
    process.exit(2)
  }
}

async function vercelGet(token, path) {
  const url = `https://api.vercel.com${path}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Vercel API ${resp.status} on ${path}: ${text.slice(0, 200)}`)
  }
  return resp.json()
}

async function findDeploymentForSha(token, projectId, teamId, sha) {
  const data = await vercelGet(
    token,
    `/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=20&target=production`,
  )
  const list = data?.deployments ?? []
  return list.find((d) => d?.meta?.githubCommitSha === sha) ?? null
}

async function getBuildLogs(token, deploymentId, teamId, limit = 60) {
  const events = await vercelGet(
    token,
    `/v3/deployments/${deploymentId}/events?teamId=${teamId}&limit=${limit}&direction=backward`,
  )
  return Array.isArray(events) ? events : (events?.events ?? [])
}

function stripAnsi(s) {
  return String(s).replace(/\u001b\[[0-9;]*m/g, '')
}

function formatLogTail(events) {
  // Build logs come as { text, type, level } records; show only error/last frames.
  const lines = events
    .map((e) => ({
      text: stripAnsi(e?.text ?? '').replace(/\s+$/, ''),
      level: e?.level ?? '',
      type: e?.type ?? '',
    }))
    .filter((e) => e.text.length > 0)
  // Show last 40 lines, prioritising error frames.
  return lines.slice(-40)
}

async function main() {
  const fileEnv = loadEnvLocal()
  const apiToken = (
    process.env.VERCEL_TOKEN ||
    fileEnv.VERCEL_TOKEN ||
    loadVercelCliToken() ||
    ''
  ).trim()
  const usingCliFallback = !apiToken

  const { projectId, teamId } = loadProjectMeta()
  const sha = (targetSha || getHeadSha()).toLowerCase()

  if (usingCliFallback) {
    out('no API token found; using Vercel CLI auth fallback for deploy checks')
  }

  out(`waiting for production deploy of ${sha.slice(0, 7)} (project ${projectId})`)

  const startedAt = Date.now()
  let deployment = null
  let lastState = null

  while (Date.now() - startedAt < TIMEOUT_MS) {
    deployment = usingCliFallback
      ? findDeploymentForShaViaCli(sha)
      : await findDeploymentForSha(apiToken, projectId, teamId, sha)
    if (deployment) {
      const state = deployment.state ?? 'UNKNOWN'
      if (state !== lastState) {
        out(`deploy ${deployment.id}: ${state}`)
        lastState = state
      }
      if (state === 'READY') {
        const url = deployment.url ? `https://${deployment.url}` : '(no url)'
        out(`READY in ${(Date.now() - startedAt) / 1000}s — ${url}`)
        out('check production URL: https://ryanrealty.vercel.app')
        process.exit(0)
      }
      if (state === 'ERROR' || state === 'CANCELED') {
        err(`deployment ${state} for SHA ${sha.slice(0, 7)} (id ${deployment.id})`)
        err(`inspector: ${deployment.inspectorUrl ?? '(none)'}`)
        if (usingCliFallback) {
          err('build-log tail unavailable in CLI fallback mode (set VERCEL_TOKEN to enable)')
        } else {
          try {
            const events = await getBuildLogs(apiToken, deployment.id, teamId, 80)
            const tail = formatLogTail(events)
            err('---- last build-log frames ----')
            for (const line of tail) process.stderr.write(line.text + '\n')
            err('-------------------------------')
          } catch (e) {
            err(`could not fetch build logs: ${e.message}`)
          }
        }
        process.exit(1)
      }
    } else if (lastState !== 'WAITING_FOR_VERCEL') {
      out('no deployment yet for that SHA — waiting for Vercel to pick up the push…')
      lastState = 'WAITING_FOR_VERCEL'
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  err(`timeout after ${TIMEOUT_MS / 1000}s without READY/ERROR for SHA ${sha.slice(0, 7)}.`)
  if (deployment) {
    err(`last seen state: ${deployment.state}; inspector: ${deployment.inspectorUrl ?? '(none)'}`)
  }
  process.exit(2)
}

main().catch((e) => {
  err(`unexpected error: ${e.message}`)
  process.exit(2)
})
