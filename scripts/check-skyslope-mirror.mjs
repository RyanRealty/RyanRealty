#!/usr/bin/env node
/**
 * G8 lock: SkySlope recon mirror has a registered inbound-only cron, a DAL
 * freshness reader, and no mutating SkySlope verbs on that path.
 *
 *   node scripts/check-skyslope-mirror.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const inbound = src('lib/tc/skyslope-inbound.ts')
checks.push({
  label: 'inbound client documents read-only after login',
  ok: /READ ONLY after session login/.test(inbound) && /Never PUT \/ PATCH \/ DELETE/.test(inbound),
})
checks.push({
  label: 'inbound client asserts an allowlist before fetch',
  ok: /export function assertInboundRequest/.test(inbound) && /inboundFetch/.test(inbound),
})
checks.push({
  label: 'inbound client has no PUT/PATCH/DELETE methods',
  ok: !/method:\s*'PUT'|method:\s*'PATCH'|method:\s*'DELETE'/.test(inbound),
})
const postBlocks = [...inbound.matchAll(/inboundFetch\(`[^`]+`,\s*\{([\s\S]*?)\}\)/g)].map((m) => m[1])
const postToFiles = postBlocks.some((block) => /method:\s*'POST'/.test(block) && /\/api\/files/.test(block))
checks.push({
  label: 'inbound POST is login only',
  ok: /method: 'POST'/.test(inbound) && /\/auth\/login/.test(inbound) && !postToFiles,
})

const dal = src('lib/data/tc/skyslope-mirror.ts')
checks.push({
  label: 'DAL exports getSkySlopeMirrorFreshness + refreshSkySlopeMirrorInbound',
  ok:
    /export async function getSkySlopeMirrorFreshness/.test(dal) &&
    /export async function refreshSkySlopeMirrorInbound/.test(dal),
})
checks.push({
  label: 'refresh refuses when Files API keys are missing',
  ok: /hasSkySlopeInboundCreds/.test(dal) && /SKYSLOPE inbound keys missing/.test(dal),
})

const cron = src('app/api/cron/skyslope-mirror-refresh/route.ts')
checks.push({
  label: 'cron is inbound-only and auth-gated',
  ok:
    /requireCronAuth/.test(cron) &&
    /refreshSkySlopeMirrorInbound/.test(cron) &&
    !/method:\s*'PUT'|method:\s*'PATCH'|method:\s*'DELETE'/.test(cron),
})

const vercel = src('vercel.json')
checks.push({
  label: 'vercel.json registers /api/cron/skyslope-mirror-refresh',
  ok: /\/api\/cron\/skyslope-mirror-refresh/.test(vercel),
})

const heartbeat = src('lib/pipeline-heartbeat.ts')
checks.push({
  label: 'pipeline heartbeat grades the SkySlope mirror',
  ok: /export function evalSkySlopeMirror/.test(heartbeat) && /skySlopeMirrorHours/.test(heartbeat),
})

const health = src('app/api/cron/loop-health-check/route.ts')
checks.push({
  label: 'loop-health-check probes getSkySlopeMirrorFreshness',
  ok: /getSkySlopeMirrorFreshness/.test(health) && /evalSkySlopeMirror/.test(health),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads mirror count from the DAL (not limit-1 length)',
  ok: /getSkySlopeMirrorFreshness/.test(signals) && /skyFreshness\.rowCount/.test(signals),
})

const closings = src('app/admin/(protected)/closings/page.tsx')
checks.push({
  label: 'closings board surfaces mirror freshness',
  ok: /getSkySlopeMirrorFreshness/.test(closings) && /SkySlope recon mirror/.test(closings),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} passed`)
