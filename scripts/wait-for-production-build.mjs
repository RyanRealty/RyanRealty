#!/usr/bin/env node
/**
 * wait-for-production-build.mjs — `npm run ship` calls this right before it
 * merges: while another production build is running (or main's newest commit
 * is about to start one), wait, so two production builds never share the
 * database. The rule and its evidence: scripts/lib/production-build-gate.mjs.
 *
 * Never blocks a ship for good: it gives up waiting after
 * SHIP_BUILD_WAIT_MAX_MS (default 25 min) and merges anyway, and it lets the
 * merge go at once when it cannot ask Vercel (no token, API error). It always
 * exits 0. SHIP_BUILD_WAIT_SKIP=1 skips it.
 *
 * Token: VERCEL_TOKEN from the environment or .env.local, else the Vercel CLI
 * login, the same sources deploy:verify reads. The token is never printed.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { productionBuildGate } from './lib/production-build-gate.mjs'

const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA'
const TEAM_ID = process.env.VERCEL_ORG_ID || 'team_zwYQPapH0CpleD7RzJ7WctGO'
const MAX_WAIT_MS = Number(process.env.SHIP_BUILD_WAIT_MAX_MS ?? 25 * 60 * 1000)
const POLL_MS = Number(process.env.SHIP_BUILD_WAIT_POLL_MS ?? 20 * 1000)

function say(line) {
  console.log(`ship: ${line}`)
}

function envLocalToken() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return ''
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*VERCEL_TOKEN\s*=\s*(.*)\s*$/.exec(line)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return ''
}

function cliToken() {
  for (const p of [
    process.env.VERCEL_AUTH_CONFIG?.trim(),
    resolve(homedir(), '.vercel/auth.json'),
    resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
  ].filter(Boolean)) {
    try {
      if (existsSync(p)) {
        const token = String(JSON.parse(readFileSync(p, 'utf8'))?.token ?? '').trim()
        if (token) return token
      }
    } catch {
      // next candidate
    }
  }
  return ''
}

function mainTip() {
  try {
    execSync('git fetch -q origin main', { stdio: 'ignore' })
    return execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function productionDeployments(token) {
  const url =
    `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}` +
    `&target=production&limit=20`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Vercel API ${res.status}`)
  const body = await res.json()
  return Array.isArray(body?.deployments) ? body.deployments : []
}

async function main() {
  if (process.env.SHIP_BUILD_WAIT_SKIP === '1') {
    say('production build wait skipped (SHIP_BUILD_WAIT_SKIP=1)')
    return
  }
  const token = (process.env.VERCEL_TOKEN || envLocalToken() || cliToken()).trim()
  if (!token) {
    say('no Vercel token, so no production build check; merging')
    return
  }
  const started = Date.now()
  let tip = mainTip()
  let tipSince = Date.now()
  let last = ''
  for (;;) {
    let deployments
    try {
      deployments = await productionDeployments(token)
    } catch (e) {
      say(`could not list production builds (${e instanceof Error ? e.message : e}); merging`)
      return
    }
    const now = Date.now()
    const gate = productionBuildGate(deployments, { mainSha: tip, tipPendingForMs: now - tipSince, now })
    if (!gate.wait) {
      const waited = Math.round((now - started) / 1000)
      say(waited > 0 ? `no production build running after ${waited} s; merging` : 'no production build running; merging')
      return
    }
    if (now - started >= MAX_WAIT_MS) {
      say(`still waiting after ${Math.round(MAX_WAIT_MS / 60000)} min (${gate.reason}); merging anyway`)
      return
    }
    if (gate.reason !== last) {
      say(`waiting to merge: ${gate.reason}`)
      last = gate.reason
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
    const nextTip = mainTip()
    if (nextTip && nextTip !== tip) {
      tip = nextTip
      tipSince = Date.now()
    }
  }
}

main().catch((e) => {
  say(`production build check failed (${e instanceof Error ? e.message : e}); merging`)
})
