/**
 * _family4-shots.mjs — before/after screenshots for the Family 4 cities rework.
 * Animations-off pattern modeled on scripts/_shot-homepage-v3.mjs.
 *
 * Usage: node scripts/_family4-shots.mjs [--before-only|--after-only]
 * AFTER  -> local prod build at http://127.0.0.1:3033
 * BEFORE -> https://ryanrealty.vercel.app (live production)
 */
import { chromium } from '@playwright/test'

const ROUTES = ['/cities', '/cities/bend', '/cities/sisters']
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 }, // phone first — Matt reviews on his phone
  { name: '1440', width: 1440, height: 900 },
]
const TARGETS = [
  { name: 'after', base: 'http://127.0.0.1:3033' },
  { name: 'before', base: 'https://ryanrealty.vercel.app' },
]

const onlyBefore = process.argv.includes('--before-only')
const onlyAfter = process.argv.includes('--after-only')

const b = await chromium.launch()
for (const target of TARGETS) {
  if (onlyBefore && target.name !== 'before') continue
  if (onlyAfter && target.name !== 'after') continue
  for (const vp of VIEWPORTS) {
    const p = await b.newPage({ viewport: { width: vp.width, height: vp.height } })
    for (const route of ROUTES) {
      const slug = route === '/cities' ? 'cities-index' : route.split('/').pop()
      const out = `scratch/family4-rework/${target.name}-${slug}-${vp.name}.png`
      try {
        await p.goto(target.base + route, { waitUntil: 'networkidle', timeout: 60000 })
        // Dismiss first-visit chrome (auth nudge + cookie banner) so sections are visible
        for (const label of ['Maybe later', 'Essential only']) {
          try {
            await p.getByRole('button', { name: label }).first().click({ timeout: 2500 })
          } catch { /* not present */ }
        }
        await p.addStyleTag({
          content:
            '*, *::before, *::after { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }',
        })
        await p.waitForTimeout(1800)
        await p.screenshot({ path: out, fullPage: true })
        console.log('shot', out)
      } catch (e) {
        console.error('FAILED', out, e.message)
      }
    }
    await p.close()
  }
}
await b.close()
console.log('done')
