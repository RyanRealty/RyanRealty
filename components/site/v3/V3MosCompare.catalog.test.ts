import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3MosCompare.client.tsx'), 'utf8')

describe('V3MosCompare catalog install', () => {
  it('imports the installed beui-combobox source', () => {
    expect(SRC).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(SRC).toMatch(/ComboboxTrigger/)
    expect(SRC).toMatch(/ComboboxList/)
    expect(SRC).toMatch(/<ComboboxContent align="start" side="top">/)
    expect(SRC).toMatch(/<V3MosBars/)
    expect(SRC).toMatch(/ComboboxGroup/)
    expect(SRC).toMatch(/v3-mos-compare__mark/)
    expect(SRC).not.toMatch(/Seller's ≤4/)
    expect(SRC).not.toMatch(/Buyer's ≥6/)
    expect(SRC).not.toMatch(/ComboboxTrigger className=/)
    expect(SRC).not.toMatch(/ComboboxList[^>]*className=/)
    expect(SRC).not.toMatch(/v3-mos-compare__trigger/)
    expect(SRC).not.toMatch(/v3-mos-compare__panel/)
  })
})
