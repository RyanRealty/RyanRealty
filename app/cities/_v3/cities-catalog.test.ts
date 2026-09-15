import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('cities-catalog SITE-92', () => {
  it('imports the installed catalog sources the route claims', () => {
    const src = readFileSync(new URL('./cities-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/number['"]/)
  })

  it('keeps Atlas and house-alerts in the first-viewport fold and InsightCards below the stage', () => {
    const css = readFileSync(new URL('./cities-fold.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.cities-fold__drawing \.v3-atlas__frame/)
    expect(css).toMatch(/\.cities-fold \.v3-drawing__claim/)
    expect(css).toMatch(/\.cities-fold \.v3-alerts \.v3-eyebrow/)
    expect(css).toMatch(/\.cities-insight \.insight-cards/)
    expect(css).toMatch(/display: contents/)
    expect(css).toMatch(/\.cities-insight \{\s*order: 2;/)
    expect(css).toMatch(/\.cities-fold \.v3-drawing,/)
    expect(css).not.toMatch(/max-height: min\(12vh, 4\.75rem\)/)
  })

  it('installs catalog InsightCards pages, not a stacked house pager', () => {
    const src = readFileSync(new URL('./CitiesInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/<AllocationCard /)
    expect(src).toMatch(/<CompareCard /)
    expect(src).not.toMatch(/AllocationAndLiveline/)
    expect(src).not.toMatch(/data-insight-combo/)
    expect(src).not.toMatch(/hideLegend/)
  })

  it('passes V3AlertsStrip the required stickyLabel', () => {
    const src = readFileSync(new URL('./CitiesAlertStrip.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/stickyLabel=\{`\$\{PLACE\} listing alerts`\}/)
  })
})
