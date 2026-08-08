/**
 * Live UI/UX audit — https://ryan-realty.com
 * Usage: node scripts/_uiux-live-audit-2026-08-06.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'https://ryan-realty.com'
const OUT_DIR = 'out/audits'
const OUT_FILE = `${OUT_DIR}/uiux-2026-08-06-core.json`
mkdirSync(OUT_DIR, { recursive: true })

const ROUTES = [
  { page: 'home', route: '/' },
  { page: 'homes-for-sale', route: '/homes-for-sale' },
  { page: 'homes-for-sale-bend', route: '/homes-for-sale/bend' },
  { page: 'listing-detail', route: '/homes-for-sale/bend/mtn-high/60643-thunderbird-220225319' },
  { page: 'sell', route: '/sell' },
  { page: 'sell-valuation', route: '/sell/valuation' },
  { page: 'lp-seller-home-value', route: '/lp/seller-home-value' },
  { page: 'buy', route: '/buy' },
  { page: 'contact', route: '/contact' },
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

const findings = []
const seen = new Set()

function add(f) {
  const key = `${f.route}|${f.viewport}|${f.title}`
  if (seen.has(key)) return
  seen.add(key)
  findings.push(f)
}

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Essential only', 'Decline', 'Reject all', 'Accept All', 'Accept all', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 300 })) await btn.click({ timeout: 800 })
    } catch {}
  }
}

async function auditPage(browser, { page: pageName, route }, vpName) {
  const vp = VIEWPORTS[vpName]
  const ctx = await browser.newContext({
    viewport: vp,
    userAgent: vpName === 'mobile'
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
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
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 90000 })
    const status = resp?.status() ?? 0
    await dismissOverlays(page)
    await page.waitForTimeout(2000)

    if (status >= 400) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'page-load',
        severity: status >= 500 ? 'P0' : 'P1',
        hurts: ['understanding', 'trust'],
        title: `HTTP ${status} on page load`,
        evidence: `${BASE}${route} returned HTTP ${status} at ${vp.width}×${vp.height}`,
        fix: 'Fix server/render error for this route.',
        effort: 'medium',
      })
      await ctx.close()
      return
    }

    // Horizontal overflow
    const overflow = await page.evaluate(() => {
      const vw = window.innerWidth
      const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      const offenders = []
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        if (r.right > vw + 2 && r.left < vw) {
          const tag = el.tagName.toLowerCase()
          const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 2).join('.') : ''
          offenders.push(`${tag}${cls ? '.' + cls : ''} right=${Math.round(r.right)}vw=${vw}`)
        }
      }
      return { docW, vw, offenders: offenders.slice(0, 5) }
    })
    if (overflow.docW > overflow.vw + 2) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'responsive',
        severity: vpName === 'mobile' ? 'P1' : 'P2',
        hurts: ['responsive', 'understanding'],
        title: 'Horizontal overflow — page wider than viewport',
        evidence: `scrollWidth=${overflow.docW}px vs viewport=${overflow.vw}px. Offenders: ${overflow.offenders.join('; ') || 'unknown'}`,
        fix: 'Find element exceeding viewport width; add overflow-x-hidden or fix fixed widths.',
        effort: 'medium',
      })
    }

    // Broken images
    const brokenImages = await page.evaluate(() => {
      const bad = []
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect()
        if (r.width < 20 && r.height < 20) continue
        const src = img.currentSrc || img.src || ''
        if (!src || img.complete === false) bad.push(`incomplete: ${src.slice(0, 80)}`)
        else if (img.naturalWidth === 0) bad.push(`zero-size: ${src.slice(0, 80)} alt="${(img.alt || '').slice(0, 40)}"`)
      }
      return bad.slice(0, 8)
    })
    if (brokenImages.length > 0) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'media',
        severity: brokenImages.length >= 3 ? 'P1' : 'P2',
        hurts: ['trust', 'understanding'],
        title: 'Broken or failed listing/media images',
        evidence: brokenImages.join(' | '),
        fix: 'Verify image URLs, CDN, and fallback placeholders for missing photos.',
        effort: 'medium',
      })
    }

    // Empty/black hero/media
    const emptyMedia = await page.evaluate(() => {
      const issues = []
      const check = (el, label) => {
        const r = el.getBoundingClientRect()
        if (r.width < 80 || r.height < 80) return
        const style = getComputedStyle(el)
        const bg = style.backgroundColor
        const isVideo = el.tagName === 'VIDEO'
        if (isVideo && (el.readyState < 2 || el.videoWidth === 0)) issues.push(`${label}: video not loaded`)
        if (!isVideo) {
          const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
          if (rgb && +rgb[1] < 30 && +rgb[2] < 30 && +rgb[3] < 30 && r.height > 120)
            issues.push(`${label}: large dark/black block ${Math.round(r.width)}×${Math.round(r.height)}`)
        }
      }
      document.querySelectorAll('video, [class*="hero"], [class*="Hero"], [data-slot="carousel"]').forEach((el, i) => check(el, el.tagName + i))
      return issues.slice(0, 5)
    })
    if (emptyMedia.length > 0) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'media',
        severity: 'P2',
        hurts: ['trust', 'understanding'],
        title: 'Empty or black hero/media area',
        evidence: emptyMedia.join(' | '),
        fix: 'Ensure hero images/videos load with visible fallback.',
        effort: 'medium',
      })
    }

    // $0 or nonsense prices
    const priceIssues = await page.evaluate(() => {
      const text = document.body.innerText
      const bad = []
      if (/\$0(?:\.\d{2})?(?:\s|,|$)/.test(text)) bad.push('Literal $0 price visible in page text')
      if (/\$NaN|\$undefined|\$null/i.test(text)) bad.push('Invalid price string ($NaN etc)')
      const zeros = [...text.matchAll(/\$0{1,2}(?:,\d{3})*/g)].map(m => m[0])
      if (zeros.length) bad.push(`Zero-dollar patterns: ${zeros.slice(0, 5).join(', ')}`)
      return bad
    })
    if (priceIssues.length > 0) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'data',
        severity: 'P0',
        hurts: ['trust', 'conversion'],
        title: '$0 or invalid price displayed',
        evidence: priceIssues.join('; '),
        fix: 'Hide or replace $0 listings; validate price formatting in tile/detail components.',
        effort: 'quick',
      })
    }

    // Small tap targets (mobile only)
    if (vpName === 'mobile') {
      const smallTargets = await page.evaluate(() => {
        const bad = []
        const interactive = document.querySelectorAll('a, button, [role="button"], input, select, textarea, label')
        for (const el of interactive) {
          const r = el.getBoundingClientRect()
          if (r.width < 1 || r.height < 1) continue
          if (r.top < -100 || r.top > window.innerHeight + 100) continue
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue
          if (r.width < 44 || r.height < 44) {
            const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)
            bad.push(`${label}: ${Math.round(r.width)}×${Math.round(r.height)}px`)
          }
        }
        return bad.slice(0, 12)
      })
      if (smallTargets.length >= 4) {
        add({
          page: pageName, route, viewport: 'mobile', dimension: 'touch',
          severity: smallTargets.length >= 8 ? 'P1' : 'P2',
          hurts: ['conversion', 'responsive'],
          title: 'Interactive elements below 44×44px tap target minimum',
          evidence: smallTargets.join('; '),
          fix: 'Increase padding/min-height on nav icons, filters, and footer links for mobile.',
          effort: 'medium',
        })
      }
    }

    // Text truncation / cut off (visible overflow hidden with clipped text)
    const clippedText = await page.evaluate(() => {
      const bad = []
      const walk = (el) => {
        if (bad.length >= 8) return
        const style = getComputedStyle(el)
        if ((style.overflow === 'hidden' || style.textOverflow === 'ellipsis') && el.childElementCount === 0) {
          const r = el.getBoundingClientRect()
          if (r.width < 40 || r.height < 10 || r.top < 0 || r.top > window.innerHeight) return
          if (el.scrollWidth > el.clientWidth + 4 && el.textContent.trim().length > 20) {
            bad.push(`"${el.textContent.trim().slice(0, 50)}..." clipped (${Math.round(r.width)}px wide)`)
          }
        }
        for (const c of el.children) walk(c)
      }
      walk(document.body)
      return bad
    })
    const severeClip = clippedText.filter(t => !t.includes('...') || t.length > 30)
    if (severeClip.length >= 3) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'typography',
        severity: 'P2',
        hurts: ['understanding'],
        title: 'Important text visibly truncated',
        evidence: severeClip.slice(0, 5).join(' | '),
        fix: 'Allow wrapping or expand container for headings/addresses on narrow viewports.',
        effort: 'quick',
      })
    }

    // Overlapping interactive elements
    const overlaps = await page.evaluate(() => {
      const inter = [...document.querySelectorAll('a, button, input, select, textarea')].filter(el => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 20 && r.height > 20 && r.top >= 0 && r.top < window.innerHeight && s.visibility !== 'hidden'
      })
      const pairs = []
      for (let i = 0; i < Math.min(inter.length, 40); i++) {
        for (let j = i + 1; j < Math.min(inter.length, 40); j++) {
          const a = inter[i].getBoundingClientRect()
          const b = inter[j].getBoundingClientRect()
          const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
          if (overlap) {
            const areaA = a.width * a.height
            const areaB = b.width * b.height
            const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            const overlapArea = overlapW * overlapH
            const minArea = Math.min(areaA, areaB)
            if (overlapArea / minArea > 0.3) {
              pairs.push(`${inter[i].tagName}/${inter[j].tagName} ~${Math.round(overlapArea)}px²`)
            }
          }
        }
      }
      return pairs.slice(0, 5)
    })
    if (overlaps.length >= 2) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'layout',
        severity: 'P1',
        hurts: ['conversion', 'responsive'],
        title: 'Overlapping interactive elements',
        evidence: overlaps.join('; '),
        fix: 'Adjust z-index, spacing, or sticky header/footer stacking.',
        effort: 'medium',
      })
    }

    // Mobile nav drawer
    if (vpName === 'mobile') {
      const menuBtn = page.getByRole('button', { name: /menu|navigation|open/i }).first()
      let hasMenu = false
      try {
        hasMenu = await menuBtn.isVisible({ timeout: 1000 })
      } catch {}
      if (hasMenu) {
        try {
          await menuBtn.click({ timeout: 3000 })
          await page.waitForTimeout(800)
          const drawerOk = await page.evaluate(() => {
            const nav = document.querySelector('[role="dialog"], nav[data-state="open"], [data-slot="sheet-content"], aside')
            if (!nav) return { ok: false, reason: 'No drawer/sheet opened after menu tap' }
            const links = nav.querySelectorAll('a')
            return { ok: links.length >= 3, reason: `Drawer found with ${links.length} links` }
          })
          if (!drawerOk.ok) {
            add({
              page: pageName, route, viewport: 'mobile', dimension: 'navigation',
              severity: 'P1',
              hurts: ['understanding', 'conversion'],
              title: 'Mobile menu drawer fails to open or is empty',
              evidence: drawerOk.reason,
              fix: 'Verify hamburger triggers Sheet/Dialog with nav links.',
              effort: 'medium',
            })
          }
          // Close drawer
          const closeBtn = page.getByRole('button', { name: /close|menu/i }).first()
          try { if (await closeBtn.isVisible({ timeout: 500 })) await closeBtn.click() } catch {}
        } catch (e) {
          add({
            page: pageName, route, viewport: 'mobile', dimension: 'navigation',
            severity: 'P1',
            hurts: ['conversion'],
            title: 'Mobile menu button not tappable',
            evidence: `Menu button visible but click failed: ${String(e).slice(0, 120)}`,
            fix: 'Fix hamburger hit area and z-index.',
            effort: 'quick',
          })
        }
      }
    }

    // Search list/map switcher (mobile, search routes)
    if (vpName === 'mobile' && (route.includes('/homes-for-sale'))) {
      const mapSwitcher = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, a')].filter(el => /map|list|grid/i.test(el.textContent || el.getAttribute('aria-label') || ''))
        return btns.map(el => {
          const r = el.getBoundingClientRect()
          return { text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.top < window.innerHeight }
        }).filter(b => b.visible)
      })
      if (mapSwitcher.length === 0 && route !== '/homes-for-sale/bend/mtn-high/60643-thunderbird-220225319') {
        add({
          page: pageName, route, viewport: 'mobile', dimension: 'search',
          severity: 'P2',
          hurts: ['conversion', 'understanding'],
          title: 'No visible list/map toggle on mobile search',
          evidence: 'No button/link with Map or List label found in viewport after load.',
          fix: 'Expose persistent list/map switcher on mobile search results.',
          effort: 'medium',
        })
      } else if (mapSwitcher.some(b => b.w < 44 || b.h < 44)) {
        add({
          page: pageName, route, viewport: 'mobile', dimension: 'search',
          severity: 'P2',
          hurts: ['conversion'],
          title: 'List/map switcher tap target too small',
          evidence: mapSwitcher.map(b => `${b.text}: ${b.w}×${b.h}px`).join('; '),
          fix: 'Enlarge map/list toggle to 44px minimum height.',
          effort: 'quick',
        })
      }
    }

    // Primary CTA clarity (conversion pages)
    const conversionRoutes = ['/sell', '/sell/valuation', '/lp/seller-home-value', '/contact', '/buy']
    if (conversionRoutes.some(r => route === r || route.startsWith(r))) {
      const cta = await page.evaluate(() => {
        const primary = [...document.querySelectorAll('button, a[href]')].filter(el => {
          const r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          if (r.top > window.innerHeight * 1.5 || r.width < 40) return false
          if (s.display === 'none' || s.visibility === 'hidden') return false
          const text = (el.textContent || '').trim()
          return /get|start|submit|contact|schedule|value|estimate|call|send|free/i.test(text) && text.length < 60
        })
        const aboveFold = primary.filter(el => el.getBoundingClientRect().top < window.innerHeight * 0.85)
        return {
          count: primary.length,
          aboveFold: aboveFold.length,
          labels: aboveFold.slice(0, 4).map(el => (el.textContent || '').trim().slice(0, 50)),
        }
      })
      if (cta.aboveFold === 0) {
        add({
          page: pageName, route, viewport: vpName, dimension: 'conversion',
          severity: 'P1',
          hurts: ['conversion', 'understanding'],
          title: 'No clear primary CTA above the fold',
          evidence: `Found ${cta.count} action elements total but none in first 85vh. Labels below fold: ${cta.labels.join(', ') || 'none'}`,
          fix: 'Add prominent hero CTA (Get home value, Contact us, Start search) visible without scrolling.',
          effort: 'medium',
        })
      }
    }

    // Form friction on LP/contact/valuation
    if (['/lp/seller-home-value', '/sell/valuation', '/contact'].includes(route)) {
      const formInfo = await page.evaluate(() => {
        const forms = document.querySelectorAll('form')
        const inputs = document.querySelectorAll('form input:not([type="hidden"]), form textarea, form select')
        const required = [...inputs].filter(i => i.required || i.getAttribute('aria-required') === 'true')
        const labels = [...inputs].filter(i => {
          const id = i.id
          const hasLabel = id && document.querySelector(`label[for="${id}"]`)
          const aria = i.getAttribute('aria-label')
          return !hasLabel && !aria && i.type !== 'submit'
        })
        return { formCount: forms.length, inputCount: inputs.length, required: required.length, unlabeled: labels.length }
      })
      if (formInfo.formCount === 0) {
        add({
          page: pageName, route, viewport: vpName, dimension: 'forms',
          severity: 'P0',
          hurts: ['conversion'],
          title: 'Expected lead form missing on conversion page',
          evidence: 'No <form> element found after page load.',
          fix: 'Render lead capture form on this conversion route.',
          effort: 'large',
        })
      } else if (formInfo.unlabeled >= 3) {
        add({
          page: pageName, route, viewport: vpName, dimension: 'forms',
          severity: 'P2',
          hurts: ['conversion', 'understanding'],
          title: 'Form fields missing visible labels',
          evidence: `${formInfo.unlabeled} of ${formInfo.inputCount} inputs lack label or aria-label.`,
          fix: 'Add Label components for every input.',
          effort: 'quick',
        })
      }
    }

    // Page-specific manual checks via DOM
    if (route === '/' && vpName === 'mobile') {
      const hero = await page.evaluate(() => {
        const h1 = document.querySelector('h1')
        if (!h1) return 'No H1 on homepage'
        const r = h1.getBoundingClientRect()
        return r.top > window.innerHeight ? `H1 below fold at y=${Math.round(r.top)}` : null
      })
      if (hero) {
        add({
          page: pageName, route, viewport: 'mobile', dimension: 'hero',
          severity: 'P2',
          hurts: ['understanding', 'conversion'],
          title: 'Homepage headline not visible on first screen',
          evidence: hero,
          fix: 'Reduce hero height or move H1 above fold on mobile.',
          effort: 'medium',
        })
      }
    }

    if (consoleErrors.length >= 3) {
      add({
        page: pageName, route, viewport: vpName, dimension: 'console',
        severity: 'P2',
        hurts: ['trust'],
        title: 'Multiple console errors on page load',
        evidence: consoleErrors.slice(0, 4).join(' | '),
        fix: 'Fix JS errors that may break interactivity.',
        effort: 'medium',
      })
    }
  } catch (e) {
    add({
      page: pageName, route, viewport: vpName, dimension: 'page-load',
      severity: 'P0',
      hurts: ['understanding', 'trust'],
      title: 'Page failed to load in audit',
      evidence: String(e).slice(0, 200),
      fix: 'Investigate timeout or crash on this route.',
      effort: 'large',
    })
  } finally {
    await ctx.close()
  }
}

const browser = await chromium.launch({ headless: true })

for (const r of ROUTES) {
  for (const vp of ['desktop', 'mobile']) {
    console.log(`Auditing ${r.route} @ ${vp}...`)
    await auditPage(browser, r, vp)
  }
}

await browser.close()

// Sort by severity
const sevOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
findings.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))

writeFileSync(OUT_FILE, JSON.stringify(findings, null, 2))
console.log(`\nWrote ${findings.length} findings to ${OUT_FILE}`)
console.log(JSON.stringify(findings, null, 2))
