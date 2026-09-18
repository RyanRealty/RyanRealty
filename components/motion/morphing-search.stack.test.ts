import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('components/motion/morphing-search.tsx', 'utf8')

describe('MorphingSearch open stack — SITE-121 phone type-in', () => {
  it('keeps the layoutId shell from sitting on top of the field', () => {
    expect(SRC).toMatch(/data-v3-morph="panel"[\s\S]{0,180}pointer-events-none/)
    expect(SRC).toMatch(/pointerEvents:\s*["']none["']/)
    expect(SRC).toContain('data-v3-morph="input"')
    expect(SRC).toContain('data-v3-morph="catcher"')
  })

  it('stacks catcher under the dialog and isolates the typeable row', () => {
    expect(SRC).toMatch(/data-v3-morph="catcher"[\s\S]{0,160}z-0/)
    expect(SRC).toMatch(/data-v3-morph="dialog"[\s\S]{0,80}isolate/)
    expect(SRC).toMatch(/data-v3-morph="input"[\s\S]{0,120}bg-background/)
  })

  it('does not wrap the size-0 overlay group in a motion.div', () => {
    expect(SRC).toMatch(
      /key="morphing-search-overlay"\s+className="fixed left-0 top-0 size-0"/,
    )
    expect(SRC).not.toMatch(
      /<motion\.div\s+key="morphing-search-overlay"/,
    )
  })

  it('lets the open dialog receive touchmove so iOS can type', () => {
    expect(SRC).toContain('dialogRef.current?.contains(target)')
  })
})
