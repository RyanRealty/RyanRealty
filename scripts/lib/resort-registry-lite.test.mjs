import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  RESORT_REGISTRY_LITE_GENERATOR,
  RESORT_REGISTRY_LITE_PATH,
  RESORT_REGISTRY_PATH,
  deriveResortRegistryLite,
  serializeResortRegistryLite,
} from './resort-registry-lite.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('data/resort-communities.lite.json', () => {
  // The client reads the lite file, the server the full registry. An edit to
  // the full registry that is not regenerated here would let a search chip or
  // an alias match on the client disagree with the page the server renders.
  it('is exactly what the generator derives from the full registry', () => {
    const full = JSON.parse(readFileSync(join(ROOT, RESORT_REGISTRY_PATH), 'utf8'))
    const committed = readFileSync(join(ROOT, RESORT_REGISTRY_LITE_PATH), 'utf8')
    expect(
      committed,
      `${RESORT_REGISTRY_LITE_PATH} is stale. Run: node ${RESORT_REGISTRY_LITE_GENERATOR}`,
    ).toBe(serializeResortRegistryLite(deriveResortRegistryLite(full)))
  })
})
