import { chromium } from 'playwright'

// Verifies the KB community page across community TYPES. Pass slugs via CSLUGS env
// (comma-sep) or use the defaults: a resort (tetherow), an unreliable-boundary resort
// (broken-top), a master-planned (northwest-crossing), and whatever else is passed.
const slugs = (process.env.CSLUGS || 'tetherow,broken-top,northwest-crossing,widgi-creek').split(',')
const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })

for (const slug of slugs) {
  const p = await ctx.newPage()
  const url = `http://localhost:3010/communities/${slug}`
  const resp = await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => ({ status: () => 'ERR ' + e.message }))
  await p.waitForTimeout(2000)
  await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(() => {})
  await p.waitForTimeout(400)
  const info = await p.evaluate(() => {
    const kbRoot = !!document.querySelector('main.kb-root')
    const sections = Array.from(document.querySelectorAll('.kb-root section[id]')).map((s) => s.id)
    const heroH = document.querySelector('.kb-root .hero-h, .kb-root .hero-h1, .kb-root #top h1, .kb-root .hero-title')?.textContent?.trim()?.slice(0, 60)
    const jsonld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .flatMap((s) => { try { const j = JSON.parse(s.textContent || '{}'); return (Array.isArray(j['@graph']) ? j['@graph'] : [j]).map((x) => x['@type']) } catch { return [] } })
    const tracker = !!document.querySelector('[data-kb-section-tracker], main.kb-root') // KbSectionTracker renders null; check via section ids existing
    return { kbRoot, sectionCount: sections.length, sections, heroH, jsonldTypes: [...new Set(jsonld.flat())] }
  })
  const code = typeof resp?.status === 'function' ? resp.status() : '?'
  console.log(`\n=== /communities/${slug} === http=${code}`)
  console.log(`  kb-root=${info.kbRoot} sections=${info.sectionCount} [${info.sections.join(', ')}]`)
  console.log(`  hero="${info.heroH}"`)
  console.log(`  JSON-LD: ${JSON.stringify(info.jsonldTypes)}`)
  await p.screenshot({ path: `/tmp/cm-${slug}.png`, fullPage: false })
  console.log(`  OK /tmp/cm-${slug}.png`)
  await p.close()
}
await b.close()
