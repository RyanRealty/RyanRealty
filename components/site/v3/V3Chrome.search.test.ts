import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const chrome = readFileSync('components/site/v3/V3Chrome.tsx', 'utf8')
const search = readFileSync('components/site/v3/V3ChromeSearch.client.tsx', 'utf8')
const morph = readFileSync('components/motion/morphing-search.tsx', 'utf8')
const morphCss = readFileSync('components/site/v3/V3MorphSearch.css', 'utf8')

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

  it('keeps empty-query cities-by-default ranking (Bend → Tetherow seeds)', () => {
    expect(search).toContain("title: 'Bend'")
    expect(search).toContain("title: 'Redmond'")
    expect(search).toContain("title: 'Sisters'")
    expect(search).toContain("title: 'Sunriver'")
    expect(search).toContain("title: 'Tetherow'")
    const bend = search.indexOf("title: 'Bend'")
    const redmond = search.indexOf("title: 'Redmond'")
    const sisters = search.indexOf("title: 'Sisters'")
    const sunriver = search.indexOf("title: 'Sunriver'")
    const tetherow = search.indexOf("title: 'Tetherow'")
    expect(bend).toBeLessThan(redmond)
    expect(redmond).toBeLessThan(sisters)
    expect(sisters).toBeLessThan(sunriver)
    expect(sunriver).toBeLessThan(tetherow)
    expect(search).toContain('return typed.length > 0 ? typed : PLACE_SEEDS')
  })

  it('loads house morph CSS on chrome search and densifies phone typeahead rows', () => {
    expect(search).toContain("import './V3MorphSearch.css'")
    expect(morphCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*\[data-v3-morph='dialog'\] \[role='option'\][\s\S]{0,160}padding-block:\s*0;/,
    )
    expect(morphCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*\[data-v3-morph='dialog'\] \[role='listbox'\][\s\S]{0,80}padding:\s*0\.125rem/,
    )
    expect(morph).toContain('px-3 py-2.5')
    expect(morph).toContain('className="overscroll-contain overflow-y-auto p-2"')
  })
})
