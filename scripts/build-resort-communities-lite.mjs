#!/usr/bin/env node
/**
 * Regenerates data/resort-communities.lite.json from data/resort-communities.json.
 * See scripts/lib/resort-registry-lite.mjs for why the lite file exists.
 *
 *   node scripts/build-resort-communities-lite.mjs           # write
 *   node scripts/build-resort-communities-lite.mjs --check   # exit 1 if stale
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RESORT_REGISTRY_PATH,
  RESORT_REGISTRY_LITE_PATH,
  deriveResortRegistryLite,
  serializeResortRegistryLite,
} from './lib/resort-registry-lite.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const full = JSON.parse(readFileSync(join(ROOT, RESORT_REGISTRY_PATH), 'utf8'))
const next = serializeResortRegistryLite(deriveResortRegistryLite(full))
const target = join(ROOT, RESORT_REGISTRY_LITE_PATH)
const current = existsSync(target) ? readFileSync(target, 'utf8') : null

if (process.argv.includes('--check')) {
  if (current === next) {
    console.log(`${RESORT_REGISTRY_LITE_PATH} is current (${next.length} bytes).`)
    process.exit(0)
  }
  console.error(`${RESORT_REGISTRY_LITE_PATH} is stale. Run: node scripts/build-resort-communities-lite.mjs`)
  process.exit(1)
}

if (current === next) {
  console.log(`${RESORT_REGISTRY_LITE_PATH} already current (${next.length} bytes).`)
} else {
  writeFileSync(target, next)
  console.log(`Wrote ${RESORT_REGISTRY_LITE_PATH} (${next.length} bytes).`)
}
