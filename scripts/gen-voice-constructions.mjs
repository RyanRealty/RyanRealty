#!/usr/bin/env node
/**
 * gen-voice-constructions.mjs — generate lib/brand-voice/constructions.ts from
 * scripts/voice-constructions.cjs, and verify they have not drifted.
 *
 * The .cjs is the source of truth (Node scripts + the CI gate read it). The
 * .ts mirror exists because lib/voice/check.ts runs INSIDE the Next bundle and
 * cannot require a .cjs. Both must always agree, which is what ci:voice-
 * constructions-parity asserts.
 *
 *   node scripts/gen-voice-constructions.mjs           verify parity, exit 1 on drift
 *   node scripts/gen-voice-constructions.mjs --write   regenerate the mirror
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'lib/brand-voice/constructions.ts')
const require = createRequire(import.meta.url)
const { CONSTRUCTIONS } = require('./voice-constructions.cjs')

const payload = CONSTRUCTIONS.map(({ id, rule, label, source, fix }) => ({ id, rule, label, source, fix }))
const body = `/**
 * GENERATED FILE — do not edit.
 *
 * In-bundle mirror of scripts/voice-constructions.cjs, which is the
 * machine-readable form of the 'Banned constructions' section of
 * marketing_brain_skills/brand-voice/VOICE.md.
 *
 * Regenerate: node scripts/gen-voice-constructions.mjs --write
 * Parity enforced by ci:voice-constructions-parity.
 */

export type VoiceConstruction = {
  id: string
  rule: number
  label: string
  source: string
  fix: string
}

export const VOICE_CONSTRUCTIONS: readonly VoiceConstruction[] = ${JSON.stringify(payload, null, 2)} as const
`

if (process.argv.includes('--write')) {
  writeFileSync(OUT, body)
  console.log(`✓ Regenerated lib/brand-voice/constructions.ts (${payload.length} constructions)`)
  process.exit(0)
}

let current = ''
try {
  current = readFileSync(OUT, 'utf8')
} catch {
  console.error('✗ lib/brand-voice/constructions.ts is missing. Run with --write.')
  process.exit(1)
}
if (current.trim() !== body.trim()) {
  console.error('✗ lib/brand-voice/constructions.ts has drifted from scripts/voice-constructions.cjs.')
  console.error('  The .cjs is the source of truth. Regenerate: node scripts/gen-voice-constructions.mjs --write')
  process.exit(1)
}
console.log(`✓ Construction parity: ${payload.length} patterns, .cjs and in-bundle mirror agree.`)
