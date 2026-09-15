import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('cities-catalog SITE-92', () => {
  it('imports the installed catalog sources the route claims', () => {
    const src = readFileSync(new URL('./cities-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/number['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/infinite-masonry['"]/)
  })

  it('keeps Atlas and house-alerts in the first-viewport fold and InsightCards below the stage', () => {
    const css = readFileSync(new URL('./cities-fold.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.cities-fold__drawing \.v3-atlas__frame/)
    expect(css).toMatch(/\.cities-fold \.v3-drawing__claim/)
    expect(css).toMatch(/\.cities-fold \.v3-alerts \.v3-eyebrow/)
    expect(css).toMatch(/\.cities-insight \.insight-cards/)
    expect(css).toMatch(/display: contents/)
    expect(css).toMatch(/\.cities-fold__figure \{\s*order: 2;/)
    expect(css).toMatch(/\.cities-masonry \{\s*order: 3;/)
    expect(css).toMatch(/\.cities-insight \{\s*order: 4;/)
    expect(css).toMatch(/\.cities-fold \.v3-drawing,/)
    expect(css).not.toMatch(/max-height: min\(12vh, 4\.75rem\)/)
    expect(css).not.toMatch(/min\(28vh, 8\.5rem\)/)
    expect(css).toMatch(/min\(56vh, 28rem\)/)
    expect(css).toMatch(/\.cities-fold__drawing \.v3-atlas__stage/)
    expect(css).toMatch(/overflow: hidden/)
  })

  it('installs catalog InsightCards pages as a year scrubber, not a clock axis', () => {
    const src = readFileSync(new URL('./CitiesInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/<AllocationCard /)
    expect(src).toMatch(/<CompareCard/)
    expect(src).toMatch(/windowSecs=\{YEAR_WINDOW_SECS\}/)
    expect(src).toMatch(/formatTime=\{formatCloseYear\}/)
    expect(src).toMatch(/month: 'short'/)
    expect(src).toMatch(/year: 'numeric'/)
    expect(src).not.toMatch(/AllocationAndLiveline/)
    expect(src).not.toMatch(/data-insight-combo/)
    expect(src).not.toMatch(/hideLegend/)
  })

  it('installs catalog InfiniteMasonry for featured city photographs', () => {
    const src = readFileSync(new URL('./CitiesMasonry.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/infinite-masonry['"]/)
    expect(src).toMatch(/<InfiniteMasonry/)
    expect(src).toMatch(/onLoadMore/)
    expect(src).not.toMatch(/320x240/)
  })

  it('passes V3AlertsStrip the required stickyLabel', () => {
    const src = readFileSync(new URL('./CitiesAlertStrip.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/stickyLabel=\{`\$\{PLACE\} listing alerts`\}/)
  })
})
