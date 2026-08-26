#!/usr/bin/env node
/**
 * check-grok-models.mjs — the model ids in lib/grok/client.ts must exist.
 *
 * Why this is a gate and not a comment: xAI retires model ids without
 * warning, and the failure is silent in the worst way. `grok-2-1212` sat
 * pinned in lib/grok-text.ts long after the account stopped serving it, so
 * every call through that path returned 404 and every caller swallowed it.
 * A gate turns that into a red build instead of a quiet dead feature.
 *
 * Needs XAI_API_KEY. Skips cleanly without one so the secret-less static
 * chain still passes; the nightly/local run is where it bites.
 *
 * Usage:
 *   node scripts/check-grok-models.mjs
 *   node scripts/check-grok-models.mjs --json
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const CLIENT = resolve(ROOT, 'lib/grok/client.ts')
const JSON_OUT = process.argv.includes('--json')

function declaredModels() {
  const source = readFileSync(CLIENT, 'utf8')
  const block = source.match(/export const GROK_MODELS = \{([\s\S]*?)\} as const/)
  if (!block) {
    console.error('check-grok-models: could not find GROK_MODELS in lib/grok/client.ts')
    process.exit(1)
  }
  const ids = new Map()
  for (const line of block[1].split('\n')) {
    const match = line.match(/^\s*(\w+):\s*'([^']+)'/)
    if (match) ids.set(match[1], match[2])
  }
  return ids
}

async function main() {
  const declared = declaredModels()
  if (declared.size === 0) {
    console.error('check-grok-models: GROK_MODELS is empty')
    process.exit(1)
  }

  const key = process.env.XAI_API_KEY
  if (!key?.trim()) {
    const message = 'check-grok-models: XAI_API_KEY not set, skipping live check'
    if (JSON_OUT) console.log(JSON.stringify({ ok: true, skipped: true, declared: [...declared.values()] }))
    else console.log(message)
    process.exit(0)
  }

  const res = await fetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${key.trim()}` },
  })
  if (!res.ok) {
    console.error(`check-grok-models: xAI /v1/models returned ${res.status}`)
    process.exit(1)
  }
  const body = await res.json()
  const live = new Set((body?.data ?? []).map((m) => m.id))

  const missing = [...declared.entries()].filter(([, id]) => !live.has(id))

  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: missing.length === 0, missing, live: [...live] }, null, 2))
  } else if (missing.length > 0) {
    console.error('check-grok-models: FAIL. These ids are no longer served by the account:')
    for (const [role, id] of missing) console.error(`  ${role}: ${id}`)
    console.error('\nLive ids:', [...live].sort().join(', '))
    console.error('\nFix lib/grok/client.ts GROK_MODELS, then re-run.')
  } else {
    console.log(`check-grok-models: OK. ${declared.size} declared ids all served.`)
  }

  process.exit(missing.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('check-grok-models: threw', err?.message ?? err)
  process.exit(1)
})
