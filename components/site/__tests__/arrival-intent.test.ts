import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve('components/site/v3/ArrivalIntent.client.tsx')

describe('ArrivalIntent source lock', () => {
  it('contains Buy, Sell, Look and does not import Dialog', () => {
    const src = readFileSync(SRC, 'utf8')
    expect(src).toMatch(/\bBuy\b/)
    expect(src).toMatch(/\bSell\b/)
    expect(src).toMatch(/\bLook\b/)
    expect(src).not.toMatch(/from ['"]@\/components\/ui\/dialog['"]/)
    expect(src).not.toMatch(/from ['"]@\/components\/ui\/sheet['"]/)
  })
})
