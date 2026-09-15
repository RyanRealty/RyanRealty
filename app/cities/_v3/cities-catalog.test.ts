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
    expect(css).toMatch(/\.cities-fold \.v3-mos/)
    expect(css).toMatch(/\.cities-fold \.v3-alerts \.v3-eyebrow/)
    expect(css).toMatch(/\.cities-insight \.insight-cards/)
    expect(css).toMatch(/display: contents/)
    expect(css).toMatch(/\.cities-fold__figure \{\s*order: 2;/)
    expect(css).toMatch(/\.cities-masonry \{\s*order: 3;/)
    expect(css).toMatch(/\.cities-insight \{\s*order: 4;/)
    expect(css).toMatch(/\.cities-fold \.v3-mos__plain/)
    expect(css).not.toMatch(/max-height: min\(12vh, 4\.75rem\)/)
    expect(css).not.toMatch(/min\(28vh, 8\.5rem\)/)
    expect(css).toMatch(/min\(22vh, 10\.5rem\)/)
    expect(css).toMatch(/\.cities-fold__drawing \.v3-atlas__stage/)
    expect(css).toMatch(/overflow: visible/)
    expect(css).toMatch(/\.cities-fold \.v3-alerts__row/)
    expect(css).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(css).toMatch(/#featured-cities > :has\(> \.v3-ledger__list\)/)
    expect(css).not.toMatch(/order: -1/)
  })

  it('installs catalog InsightCards as one Allocation + Liveline object', () => {
    const src = readFileSync(new URL('./CitiesInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/<AllocationCard /)
    expect(src).toMatch(/<CompareCard/)
    expect(src).toMatch(/hideLegend/)
    expect(src).toMatch(/windowSecs=\{YEAR_WINDOW_SECS\}/)
    expect(src).toMatch(/formatTime=\{formatCloseYear\}/)
    expect(src).toMatch(/monthLabels=\{monthLabels\}/)
    expect(src).toMatch(/formatPublishedCloseMonth/)
    expect(src).not.toMatch(/Scrub the year of closes/)
    expect(src).not.toMatch(/AllocationAndLiveline/)
    expect(src).not.toMatch(/data-insight-combo/)
  })

  it('installs catalog InfiniteMasonry for featured city photographs', () => {
    const src = readFileSync(new URL('./CitiesMasonry.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/infinite-masonry['"]/)
    expect(src).toMatch(/<InfiniteMasonry/)
    expect(src).toMatch(/onLoadMore/)
    expect(src).toMatch(/CASCADE_HEIGHTS/)
    expect(src).toMatch(/cities-masonry__name/)
    expect(src).toMatch(/cities-masonry__count/)
    expect(src).not.toMatch(/320x240/)
  })

  it('keeps combobox field chrome at rest, not an icon-only circle', () => {
    const src = readFileSync(
      new URL('../../../components/motion/combobox/trigger.tsx', import.meta.url),
      'utf8',
    )
    expect(src).toMatch(/min-w-52/)
    expect(src).toMatch(/ChevronsUpDown/)
    expect(src).toMatch(/WARM_STONE_FOCUS/)
    expect(src).toMatch(/COMBOBOX_TRIGGER_MORPH/)
    expect(src).not.toMatch(/width: context.open \? "100%" : "3rem"/)
    expect(src).not.toMatch(/opacity-0/)
    expect(src).not.toMatch(/min-w-12/)
  })

  it('passes V3AlertsStrip the required stickyLabel', () => {
    const src = readFileSync(new URL('./CitiesAlertStrip.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/stickyLabel=\{`\$\{PLACE\} listing alerts`\}/)
  })
})
