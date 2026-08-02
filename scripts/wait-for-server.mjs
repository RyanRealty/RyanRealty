#!/usr/bin/env node
/**
 * wait-for-server.mjs — poll a URL until it answers 200, with visible output.
 *
 * WHY (2026-08-02): the CI "Route smoke test" step wrapped everything in
 * `start-server-and-test`, whose only failure output is:
 *
 *     Error: Timed out waiting for: http://127.0.0.1:3000
 *
 * No status code, no timing, no server log. That step has been failing on every
 * pull request since at least 2026-07-25 (verified on unrelated branches), and
 * nobody could say why, because the wrapper reported nothing actionable. A
 * production build serving the same routes locally answers `/` with HTTP 200 in
 * 0.55s and passes 277/277 routes, so the app is not the cause — but proving
 * that from CI output alone was impossible.
 *
 * This replaces the wait half with something that says what it saw on every
 * probe, so the next red run diagnoses itself.
 *
 * Uses fetch rather than curl deliberately: same client the smoke script and
 * wait-on use, no extra tooling, and unaffected by proxy environment variables
 * that intercept curl.
 *
 * ROOT CAUSE, found 2026-08-02 and recorded here so nobody re-derives it: the
 * old waiter was `wait-on`, which is axios-based and sends `User-Agent:
 * axios/1.x`. The middleware bot screen's `BAD_BOT_RE` matches `axios`, so every
 * probe came back 403; `wait-on` only accepts 2xx, so it retried to the timeout.
 * The app was healthy throughout. This probe therefore sends an EXPLICIT
 * User-Agent rather than inheriting a runtime default — `npm run ci:probe-ua`
 * checks that UA against the live regex.
 *
 * Usage: node scripts/wait-for-server.mjs <url> [timeoutSeconds]
 * Exit 0 as soon as the URL returns 200; exit 1 on timeout.
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const url = process.argv[2] ?? 'http://127.0.0.1:3000'
const timeoutSec = Number(process.argv[3] ?? 120)
const INTERVAL_MS = 2000
const PER_REQUEST_TIMEOUT_MS = 10_000

async function probe() {
  const startedAt = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS)
    // redirect: 'manual' so a 3xx is reported as a 3xx instead of being followed
    // and masked — an unexpected redirect is exactly the kind of thing that
    // would make a naive waiter hang forever.
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { ...CI_PROBE_HEADERS },
    })
    clearTimeout(timer)
    return { status: res.status, ms: Date.now() - startedAt }
  } catch (err) {
    return {
      status: 0,
      ms: Date.now() - startedAt,
      error: `${err.name}: ${err.message}`,
    }
  }
}

const deadline = Date.now() + timeoutSec * 1000
let attempt = 0
let last = null

while (Date.now() < deadline) {
  attempt++
  last = await probe()
  if (last.status === 200) {
    console.log(`wait-for-server: ${url} ready after ${attempt} probe(s), ${(last.ms / 1000).toFixed(2)}s`)
    process.exit(0)
  }
  // Report the first probe and then every 5th, so a healthy start stays quiet
  // but a stuck one leaves a trail of exactly what it was answering.
  if (attempt === 1 || attempt % 5 === 0) {
    const detail = last.error ? ` (${last.error})` : ''
    console.log(`wait-for-server: probe ${attempt} -> http=${last.status} ${(last.ms / 1000).toFixed(2)}s${detail}`)
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS))
}

const detail = last?.error ? ` (${last.error})` : ''
console.error(
  `wait-for-server: ${url} never returned 200 within ${timeoutSec}s. ` +
    `Last: http=${last?.status ?? 'n/a'}${detail}`,
)
process.exit(1)
