import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** SITE-120 accept phrases, split so this file is not itself a hit. */
const FORBIDDEN = [
  ['Email me each', ' one'].join(''),
  ['by email, as they come on the', ' market'].join(''),
  ['Every new listing by', ' email.'].join(''),
] as const

const PLACE_SHEETS = [
  'lib/site/place-alerts.ts',
  'app/cities/[slug]/_v3/CityAlertSheet.client.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodAlertsSheet.client.tsx',
  'app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx',
  'app/subdivisions/[slug]/_v3/SubdivisionAlertSheet.client.tsx',
  'app/zip/[zip]/_v3/ZipAlertsSheet.client.tsx',
] as const

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) walk(abs, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name)) {
      out.push(abs)
    }
  }
  return out
}

describe('SITE-120 the sticky ask talks like a person', () => {
  it('keeps the old form lines out of app/ and lib/ (tests excluded)', () => {
    const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
    for (const abs of files) {
      const src = readFileSync(abs, 'utf8')
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const phrase of FORBIDDEN) {
        expect(code, `${relative(ROOT, abs)} still has "${phrase}"`).not.toContain(phrase)
      }
    }
  })

  it('every place binder carries the person-voice family', () => {
    for (const rel of PLACE_SHEETS) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      if (rel.endsWith('place-alerts.ts')) {
        expect(src).toContain('Hear about new listings in')
        expect(src).toContain('Send me new listings')
        expect(src).toContain("You're set. We'll email you when something new lists in")
        continue
      }
      expect(src, rel).toContain('Every new listing, with its price changes. Unsubscribe any time.')
      expect(src, rel).toContain("We'll email you every new listing")
    }
  })
})
