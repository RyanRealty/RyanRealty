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
  })

  it('passes V3AlertsStrip the required stickyLabel', () => {
    const src = readFileSync(new URL('./CitiesAlertStrip.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/stickyLabel=\{`\$\{PLACE\} listing alerts`\}/)
  })
})
