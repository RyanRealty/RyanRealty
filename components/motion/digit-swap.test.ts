import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/motion/digit-swap.tsx'), 'utf8')

describe('DigitSwap · money marks', () => {
  it('does not put commas and $ in a 1ch digit slot', () => {
    expect(SRC).toContain('data-slot="digit-swap-mark"')
    expect(SRC).toContain('kind === "mark"')
    expect(SRC).toContain('/\\d/.test(character)')
    expect(SRC).toContain('w-[1ch]')
    expect(SRC).toContain('data-kind="digit"')
  })
})
