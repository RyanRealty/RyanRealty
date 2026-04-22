#!/usr/bin/env node
/**
 * Merge Vercel production env (from `npx vercel env pull .env.vercel.pull`) into
 * `.env.local` for keys that are **absent** from `.env.local` (does not overwrite).
 *
 * Usage:
 *   npx vercel env pull .env.vercel.pull --environment=production --yes
 *   node scripts/merge-vercel-env-into-local.mjs
 *
 * Does not print secret values — only key names added.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

function parseEnv(raw) {
  const map = new Map()
  const order = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
      if (trimmed[eq + 1] === '"') val = val.replace(/\\n/g, '\n')
    }
    if (!map.has(key)) order.push(key)
    map.set(key, val)
  }
  return { map, order }
}

function keysInFile(raw) {
  const keys = new Set()
  for (const line of raw.split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim())
    if (m) keys.add(m[1])
  }
  return keys
}

const root = resolve(process.cwd())
const localPath = resolve(root, '.env.local')
const pullPath = resolve(root, '.env.vercel.pull')

if (!existsSync(localPath)) {
  console.error('merge-vercel-env: .env.local not found')
  process.exit(1)
}
if (!existsSync(pullPath)) {
  console.error('merge-vercel-env: .env.vercel.pull not found — run: npx vercel env pull .env.vercel.pull --environment=production --yes')
  process.exit(1)
}

const localRaw = readFileSync(localPath, 'utf8')
const pullRaw = readFileSync(pullPath, 'utf8')
const localKeys = keysInFile(localRaw)
const { map: pullMap, order: pullOrder } = parseEnv(pullRaw)

/** Vercel CLI injects these into `env pull`; they are not app secrets — never copy into .env.local. */
function shouldSkipPulledKey(key) {
  if (key.startsWith('VERCEL')) return true
  if (key.startsWith('TURBO')) return true
  if (key === 'NX_DAEMON') return true
  return false
}

const additions = []
for (const key of pullOrder) {
  if (localKeys.has(key) || shouldSkipPulledKey(key)) continue
  const val = pullMap.get(key)
  if (val === undefined || val === '') continue
  additions.push({ key, val })
}

let block = ''
if (additions.length > 0) {
  block = `\n# --- merged from Vercel production (${new Date().toISOString().slice(0, 10)}) ---\n`
  for (const { key, val } of additions) {
    const needsQuote = /[\s#"'\\]/.test(val) || val.includes('\n')
    const encoded = needsQuote
      ? `"${String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
      : val
    block += `${key}=${encoded}\n`
  }
}

let out = localRaw.replace(/\s*$/, '') + block

// Remotion reads REMOTION_* in bundle; mirror Maps key if only NEXT_PUBLIC_* is set.
const afterKeys = keysInFile(out)
const { map: merged } = parseEnv(out)
if (
  !afterKeys.has('REMOTION_GOOGLE_MAPS_KEY') &&
  merged.get('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
) {
  const v = merged.get('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
  const needsQuote = /[\s#"'\\]/.test(v) || v.includes('\n')
  const encoded = needsQuote
    ? `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    : v
  out += `\n# Remotion / headless Chromium (Map Tiles + Photorealistic 3D)\nREMOTION_GOOGLE_MAPS_KEY=${encoded}\n`
  console.log('merge-vercel-env: added REMOTION_GOOGLE_MAPS_KEY (mirrored from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)')
}

if (additions.length === 0 && out === localRaw.replace(/\s*$/, '')) {
  console.log('merge-vercel-env: no Vercel-only keys to add; .env.local unchanged (except optional REMOTION line above)')
}

writeFileSync(localPath, out, 'utf8')
if (additions.length > 0) {
  console.log(`merge-vercel-env: appended ${additions.length} keys from Vercel: ${additions.map((a) => a.key).join(', ')}`)
}

try {
  unlinkSync(pullPath)
} catch {}
