import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('cities-catalog SITE-92', () => {
  it('imports the installed catalog sources the route claims', () => {
    const src = readFileSync(new URL('./cities-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/combobox['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
    expect(src).toMatch(/from ['"]@\/components\/motion\/number['"]/)
  })

  it('passes V3AlertsStrip the required stickyLabel', () => {
    const src = readFileSync(new URL('./CitiesAlertStrip.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/stickyLabel=\{`\$\{PLACE\} listing alerts`\}/)
  })
})
