import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const chrome = readFileSync('components/site/v3/V3Chrome.tsx', 'utf8')
const search = readFileSync('components/site/v3/V3ChromeSearch.client.tsx', 'utf8')
const morph = readFileSync('components/motion/morphing-search.tsx', 'utf8')

describe('V3Chrome catalog Search', () => {
  it('mounts MorphingSearch via V3ChromeSearch (catalog install, not house invent)', () => {
    expect(chrome).toContain("import { V3ChromeSearch } from './V3ChromeSearch.client'")
    expect(chrome).toContain('<V3ChromeSearch />')
    expect(search).toContain("from '@/components/motion/morphing-search'")
    expect(search).toContain('MorphingSearch')
    expect(search).toContain('useSearchSuggest')
  })

  it('raises the portaled overlay above sticky chrome without covering the input', () => {
    expect(search).toContain('overlayClassName="z-[150]"')
    expect(search).not.toContain('overlayClassName="z-50"')
  })

  it('keeps the open morph shell from sitting on top of the phone field', () => {
    expect(morph).toMatch(/data-v3-morph="panel"[\s\S]{0,180}pointer-events-none/)
    expect(morph).toMatch(/pointerEvents:\s*["']none["']/)
    expect(morph).toContain('data-v3-morph="input"')
    expect(morph).toContain('data-v3-morph="catcher"')
    expect(morph).toMatch(/data-v3-morph="catcher"[\s\S]{0,160}z-0/)
    expect(morph).toMatch(/data-v3-morph="dialog"[\s\S]{0,80}isolate/)
    expect(morph).toMatch(/data-v3-morph="input"[\s\S]{0,120}bg-background/)
    expect(morph).not.toMatch(/<motion\.div\s+key="morphing-search-overlay"/)
    expect(morph).toContain('dialogRef.current?.contains(target)')
    expect(morph).toMatch(/reduce \|\| iconOnly\s*\n\s*\? false/)
  })
})
