/**
 * UI/UX geo-route audit — production Playwright harness.
 * Usage: node scripts/_uiux-geo-audit-2026-08-06.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE || 'https://ryan-realty.com'
const OUT = 'out/audits/uiux-2026-08-06-geo'
const SHOTS = join(OUT, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const ROUTES = [
  ['cities', '/cities'],
  ['city-bend', '/cities/bend'],
  ['neighborhood-awbrey-butte', '/cities/bend/awbrey-butte'],
  ['communities', '/communities'],
  ['community-tetherow', '/communities/tetherow'],
  ['zip-97703', '/zip/97703'],
  ['housing-market', '/housing-market'],
  ['market-central-oregon', '/housing-market/central-oregon'],
  ['open-houses', '/open-houses'],
  ['luxury-homes-bend', '/luxury-homes-bend'],
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Essential only', 'Decline', 'Reject all', 'Accept All', 'Accept all', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 200 })) await btn.click({ timeout: 500 })
    } catch {}
  }
}

async function scrollPage(page, height) {
  await page.evaluate(async (vh) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    let h = document.body.scrollHeight
    for (let y = 0; y < h; y += Math.round(vh * 0.85)) {
      window.scrollTo(0, y)
      await sleep(120)
      h = document.body.scrollHeight
    }
    window.scrollTo(0, h)
    await sleep(200)
    window.scrollTo(0, 0)
    await sleep(300)
  }, height)
}

async function auditPage(browser, name, path, vpName) {
  const { width, height } = VIEWPORTS[vpName]
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: vpName === 'mobile' ? 2 : 1,
    reducedMotion: 'reduce',
    userAgent:
      vpName === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
      localStorage.setItem('rr_consent', 'essential')
      localStorage.setItem('cookie-consent', 'declined')
    } catch {}
  })

  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

  const result = { name, path, viewport: vpName, width, height }

  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 90000 })
    result.status = resp?.status() ?? 0
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(2000)
    await scrollPage(page, height)
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    result.metrics = await page.evaluate((vpW) => {
      const body = document.body.innerText
      const scrollEl = document.scrollingElement || document.documentElement
      const overflowPx = scrollEl.scrollWidth - scrollEl.clientWidth

      const h1 = document.querySelector('h1')
      const h1Rect = h1?.getBoundingClientRect()
      const h1Style = h1 ? getComputedStyle(h1) : null

      const hero = document.querySelector('[data-hero], .hero, section:first-of-type, main > div:first-child')
      const heroRect = hero?.getBoundingClientRect()

      const mapEls = Array.from(document.querySelectorAll('[class*="map" i], [id*="map" i], .gm-style, canvas'))
        .filter((e) => {
          const r = e.getBoundingClientRect()
          return r.width > 100 && r.height > 100
        })
        .map((e) => {
          const r = e.getBoundingClientRect()
          return {
            tag: e.tagName,
            w: Math.round(r.width),
            h: Math.round(r.height),
            top: Math.round(r.top + window.scrollY),
            gmAuthFail: !!e.querySelector?.('.gm-err-container, .gm-err-content'),
          }
        })

      const gmTiles = document.querySelectorAll('.gm-style img, .gm-style canvas').length
      const mapErrorText = (body.match(/can't load Google Maps|something went wrong|Oops! Something went wrong|Map unavailable/i) || [null])[0]

      const ctas = Array.from(document.querySelectorAll('a, button'))
        .filter((el) => {
          const t = (el.textContent || '').trim()
          const r = el.getBoundingClientRect()
          if (r.width < 20 || r.height < 20) return false
          return /view|see|browse|search|contact|schedule|sign|save|explore|shop|tour|open house|get|start|learn|all homes|homes for sale|market report/i.test(t)
        })
        .slice(0, 20)
        .map((el) => {
          const r = el.getBoundingClientRect()
          return {
            text: (el.textContent || '').trim().slice(0, 60),
            w: Math.round(r.width),
            h: Math.round(r.height),
            tag: el.tagName,
            href: el.getAttribute('href')?.slice(0, 80) || null,
          }
        })

      const smallTouchTargets = Array.from(document.querySelectorAll('a, button, [role="button"]'))
        .filter((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          const visible = r.top < window.innerHeight && r.bottom > 0
          return visible && (r.width < 44 || r.height < 44)
        })
        .slice(0, 15)
        .map((el) => ({
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          w: Math.round(el.getBoundingClientRect().width),
          h: Math.round(el.getBoundingClientRect().height),
        }))

      const statBlocks = Array.from(document.querySelectorAll('[class*="stat" i], [data-stat], dl, table'))
        .filter((e) => {
          const t = e.textContent || ''
          return /\$[\d,]+|\d+%|\d+\s*(days|months|homes|listings|active|sold|median)/i.test(t)
        })
        .slice(0, 8)
        .map((e) => ({
          text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          fontSize: getComputedStyle(e).fontSize,
        }))

      const emptySignals = []
      if (/no (results|listings|homes|open houses|data|communities|neighborhoods)/i.test(body)) emptySignals.push('no-results-copy')
      if (/coming soon|under construction|placeholder/i.test(body)) emptySignals.push('placeholder-copy')
      if (/\$0|\b0 active\b|\b0 homes\b|\b0 listings\b/i.test(body)) emptySignals.push('zero-count')
      if (/NaN|undefined|null/i.test(body)) emptySignals.push('bad-data')

      const sections = Array.from(document.querySelectorAll('main section, main > div'))
        .filter((s) => {
          const r = s.getBoundingClientRect()
          return r.height > 40
        })
        .map((s) => {
          const r = s.getBoundingClientRect()
          const cs = getComputedStyle(s)
          return {
            h: Math.round(r.height),
            padTop: cs.paddingTop,
            padBottom: cs.paddingBottom,
            textLen: (s.innerText || '').trim().length,
            hasImg: !!s.querySelector('img, canvas, svg, iframe'),
          }
        })

      const crampedSections = sections.filter((s) => s.h < 80 && s.textLen > 200 && !s.hasImg)

      const overflowEls = []
      document.querySelectorAll('main *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.right > vpW + 2 && r.width > 20) {
          overflowEls.push({
            tag: el.tagName,
            cls: (el.className?.toString?.() || '').slice(0, 60),
            right: Math.round(r.right),
            w: Math.round(r.width),
          })
        }
      })

      const breadcrumbs = Array.from(document.querySelectorAll('nav[aria-label*="breadcrumb" i]')).map((n) => ({
        items: Array.from(n.querySelectorAll('li, a')).map((x) => x.textContent.trim()).filter(Boolean).slice(0, 8),
        fontSize: getComputedStyle(n).fontSize,
      }))

      return {
        overflowPx,
        overflowEls: overflowEls.slice(0, 10),
        title: document.title,
        h1: h1
          ? {
              text: h1.textContent.trim().slice(0, 120),
              fontSize: h1Style.fontSize,
              fontFamily: h1Style.fontFamily.split(',')[0],
              top: Math.round(h1Rect.top),
              h: Math.round(h1Rect.height),
            }
          : null,
        h1Count: document.querySelectorAll('h1').length,
        heroH: heroRect ? Math.round(heroRect.height) : null,
        docHeight: document.body.scrollHeight,
        mapEls,
        gmTiles,
        mapErrorText,
        ctas,
        smallTouchTargets,
        statBlocks,
        emptySignals,
        crampedSections: crampedSections.slice(0, 5),
        breadcrumbs,
        bodyPreview: body.replace(/\s+/g, ' ').slice(0, 800),
        imgsBroken: Array.from(document.querySelectorAll('img'))
          .filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:'))
          .map((i) => i.src.slice(0, 100))
          .slice(0, 5),
      }
    }, width)

    result.consoleErrors = [...new Set(consoleErrors)].slice(0, 8)
    result.pageErrors = [...new Set(pageErrors)].slice(0, 5)

    const shotBase = join(SHOTS, `${name}-${vpName}`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${shotBase}-top.png`, fullPage: false })

    const step = Math.round(height * 0.85)
    const panels = Math.min(8, Math.ceil(result.metrics.docHeight / step))
    result.panels = [`${name}-${vpName}-top.png`]
    for (let i = 1; i < panels; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * step)
      await page.waitForTimeout(350)
      const pf = `${name}-${vpName}-${String(i + 1).padStart(2, '0')}.png`
      await page.screenshot({ path: join(SHOTS, pf), fullPage: false })
      result.panels.push(pf)
    }

    result.ok = true
    console.log(`OK   ${name} ${vpName} overflow=${result.metrics.overflowPx}px h1="${result.metrics.h1?.text?.slice(0, 40) || 'none'}"`)
  } catch (e) {
    result.ok = false
    result.error = e.message
    console.log(`FAIL ${name} ${vpName}: ${e.message}`)
  }

  await ctx.close()
  return result
}

const browser = await chromium.launch()
const raw = []
for (const [name, path] of ROUTES) {
  for (const vp of ['desktop', 'mobile']) {
    raw.push(await auditPage(browser, name, path, vp))
  }
}
await browser.close()

writeFileSync(join(OUT, 'raw-metrics.json'), JSON.stringify(raw, null, 2))
console.log(`\nRaw metrics: ${OUT}/raw-metrics.json (${raw.filter((r) => r.ok).length}/${raw.length} ok)`)
