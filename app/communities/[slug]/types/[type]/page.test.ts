import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('community type listings failure is not a cacheable 200', () => {
  it('retries the homes list and throws when it still did not answer', () => {
    expect(SRC).toMatch(/refuseUnavailableListings\(listSettled\.ok, `comm-type:list \$\{slug\}\/\$\{type\}`\)/)
    expect(SRC).toMatch(/'comm-type:list'/)
    expect(SRC).not.toMatch(/unstable_noStore\(|noStore\(\)/)
  })

  it('still renders a genuine empty market after a successful zero-row read', () => {
    expect(SRC).toMatch(/measuredEmpty/)
    expect(SRC).toMatch(/None for sale in this refresh/)
  })
})
