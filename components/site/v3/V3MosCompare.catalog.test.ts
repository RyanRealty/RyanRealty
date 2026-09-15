import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3MosCompare.client.tsx'), 'utf8')

describe('V3MosCompare catalog install', () => {
  it('imports the installed beui-combobox source', () => {
    expect(SRC).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(SRC).toMatch(/ComboboxTrigger/)
    expect(SRC).toMatch(/ComboboxList/)
  })
})
