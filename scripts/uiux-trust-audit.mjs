/**
 * UI/UX trust audit — production Playwright sweep (desktop + mobile).
 * Usage: node scripts/uiux-trust-audit.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.AUDIT_URL || 'https://ryan-realty.com'
const OUT_DIR = path.join(process.cwd(), 'out/audits')
const SHOT_DIR = path.join(OUT_DIR, 'screenshots-uiux-2026-08-06-trust')
mkdirSync(SHOT_DIR, { recursive: true })

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: 'desktop' },
  mobile: { width: 390, height: 844, label: 'mobile', isMobile: true },
}

const ROUTES = [
  { path: '/about', name: 'about' },
  { path: '/team', name: 'team' },
  { path: '/team/matthew-ryan', name: 'team-matthew-ryan' },
  { path: '/reviews', name: 'reviews' },
  { path: '/blog', name: 'blog' },
  { path: '/blog/understanding-home-appraisals', name: 'blog-post', fallbackDiscover: true },
  { path: '/faq', name: 'faq' },
  { path: '/resources', name: 'resources' },
  { path: '/tools/mortgage-calculator', name: 'mortgage-calculator' },
  { path: '/login', name: 'login' },
  { path: '/signup', name: 'signup' },
]

const findings = []
let blogPostResolved = null

function addFinding(f) {
  findings.push({
    ...f,
    timestamp: new Date().toISOString(),
    url: f.url || `${BASE}${f.path}`,
  })
}

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Essential only', 'Decline', 'Reject all', 'Accept All', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click({ timeout: 800 })
        await page.waitForTimeout(400)
      }
    } catch {}
  }
}

async function checkHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth || 0)
    const clientW = doc.clientWidth
    return { overflow: scrollW > clientW + 2, scrollWidth: scrollW, clientWidth: clientW, delta: scrollW - clientW }
  })
}

async function checkPhotolessVoids(page) {
  return page.evaluate(() => {
    const issues = []
    const imgs = [...document.querySelectorAll('img')]
    const broken = imgs.filter((img) => {
      const rect = img.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 40) return false
      return !img.complete || img.naturalWidth === 0
    })
    if (broken.length) {
      issues.push({ type: 'broken-image', count: broken.length, alts: broken.slice(0, 3).map((i) => i.alt || '(no alt)') })
    }

    // Large empty placeholder boxes (common avatar/card voids)
    const voids = []
    for (const el of document.querySelectorAll('[class*="avatar"], [class*="Avatar"], [data-slot="avatar"], picture, .aspect-\\[4\\/3\\], .aspect-video')) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 60 || rect.height < 60) continue
      const bg = getComputedStyle(el).backgroundColor
      const hasImg = el.querySelector('img')?.naturalWidth > 0
      const text = (el.textContent || '').trim()
      if (!hasImg && rect.width * rect.height > 8000 && /rgb\(.*\)/.test(bg)) {
        voids.push({ tag: el.tagName, w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }

    // Team/review cards without visible headshots
    const cards = document.querySelectorAll('[class*="card"], article, [data-slot="card"]')
    let emptyPortraitCards = 0
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (rect.height < 80) continue
      const imgsInCard = card.querySelectorAll('img')
      const hasVisibleImg = [...imgsInCard].some((img) => {
        const r = img.getBoundingClientRect()
        return r.width > 48 && r.height > 48 && img.complete && img.naturalWidth > 0
      })
      const looksLikePerson = /agent|broker|review|team|member|avatar/i.test(card.className + card.textContent.slice(0, 120))
      if (looksLikePerson && !hasVisibleImg && rect.height > 120) emptyPortraitCards++
    }
    if (emptyPortraitCards > 0) issues.push({ type: 'photoless-person-card', count: emptyPortraitCards })
    if (voids.length) issues.push({ type: 'large-empty-media-box', count: voids.length, samples: voids.slice(0, 2) })

    return issues
  })
}

async function checkForms(page, routeName) {
  return page.evaluate((route) => {
    const issues = []
    const inputs = [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')]
    for (const input of inputs) {
      const rect = input.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const id = input.id
      const aria = input.getAttribute('aria-label')
      const placeholder = input.getAttribute('placeholder')
      const labelled = id ? document.querySelector(`label[for="${id}"]`) : null
      if (!labelled && !aria && !placeholder && input.type !== 'submit') {
        issues.push({ type: 'unlabeled-input', inputType: input.type || input.tagName })
      }
      if (rect.height > 0 && rect.height < 40 && input.type !== 'checkbox' && input.type !== 'radio') {
        issues.push({ type: 'small-touch-target', height: Math.round(rect.height) })
      }
    }
    const submitBtns = [...document.querySelectorAll('button[type="submit"], input[type="submit"]')]
    for (const btn of submitBtns) {
      const t = (btn.textContent || btn.value || '').trim()
      if (/submit|send|go$/i.test(t) && !/sign|log|create|calculate|save|search/i.test(t)) {
        issues.push({ type: 'vague-submit', label: t.slice(0, 40) })
      }
    }
    if (route === 'login' || route === 'signup') {
      const hasEmail = inputs.some((i) => /email/i.test(i.type + i.name + i.autocomplete + i.placeholder))
      const hasPassword = inputs.some((i) => i.type === 'password')
      if (!hasEmail) issues.push({ type: 'missing-email-field' })
      if (!hasPassword) issues.push({ type: 'missing-password-field' })
      const heading = document.querySelector('h1')?.textContent?.trim()
      if (!heading || !/log|sign|create|account/i.test(heading)) {
        issues.push({ type: 'unclear-account-heading', heading: heading || '(none)' })
      }
    }
    return issues
  }, routeName)
}

async function checkCTAIntent(page, routeName) {
  return page.evaluate((route) => {
    const issues = []
    const ctas = [...document.querySelectorAll('a[href], button')].filter((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 28) return false
      const text = (el.textContent || '').trim()
      const cls = el.className || ''
      return /btn|button|cta|primary|Button/i.test(cls + text) || el.getAttribute('role') === 'button'
    })

    const vague = ctas.filter((el) => {
      const t = (el.textContent || '').trim()
      return /^(learn more|click here|read more|get started|submit|continue)$/i.test(t)
    })
    if (vague.length) issues.push({ type: 'vague-cta', labels: vague.slice(0, 3).map((e) => e.textContent.trim()) })

    // Trust pages should not push unrelated funnels as primary
    if (['about', 'team', 'team-matthew-ryan', 'reviews', 'faq'].includes(route)) {
      const primary = ctas.find((el) => /primary|default|bg-primary/i.test(el.className))
      const pt = primary?.textContent?.trim() || ''
      if (primary && /mortgage|calculator|newsletter|subscribe/i.test(pt) && !/contact|call|schedule|meet|review/i.test(pt)) {
        issues.push({ type: 'trust-page-cta-mismatch', primaryCta: pt.slice(0, 60) })
      }
    }

    if (route === 'mortgage-calculator') {
      const hasCalc = document.querySelector('input[type="number"], input[inputmode="decimal"], [data-slot="input"]')
      const calcBtn = ctas.find((el) => /calculat|estimate|payment/i.test(el.textContent || ''))
      if (!hasCalc) issues.push({ type: 'calculator-missing-inputs' })
      if (!calcBtn) issues.push({ type: 'calculator-missing-action' })
    }

    return issues
  }, routeName)
}

async function checkTrustSignals(page, routeName) {
  return page.evaluate((route) => {
    const body = document.body.innerText
    const issues = []
    const positives = []

    if (['about', 'team', 'team-matthew-ryan', 'reviews'].includes(route)) {
      const hasLicense = /license|broker|principal|OREA|real estate/i.test(body)
      const hasLocal = /central oregon|bend|deschutes/i.test(body)
      const hasReviews = /review|rating|star|testimonial|google/i.test(body)
      if (!hasLicense && route !== 'reviews') issues.push({ type: 'missing-license-broker-signal' })
      if (!hasLocal) issues.push({ type: 'missing-local-anchor' })
      if (route === 'reviews' && !hasReviews) issues.push({ type: 'reviews-page-no-review-content' })
      if (route === 'team-matthew-ryan') {
        const hasPhoto = [...document.querySelectorAll('img')].some((img) => {
          const r = img.getBoundingClientRect()
          return r.width > 80 && r.height > 80 && img.complete && img.naturalWidth > 0
        })
        if (!hasPhoto) issues.push({ type: 'broker-profile-no-headshot' })
        const hasContact = /email|phone|contact|schedule/i.test(body)
        if (!hasContact) issues.push({ type: 'broker-profile-no-contact-path' })
      }
    }

    if (route === 'about') {
      const h1 = document.querySelector('h1')?.textContent?.trim()
      if (!h1 || h1.length < 8) issues.push({ type: 'weak-about-headline', h1: h1 || '(none)' })
    }

    if (route === 'blog' || route === 'blog-post') {
      const hasAuthor = /by |author|matt|ryan|broker/i.test(body.slice(0, 2000))
      const hasDate = /\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(body.slice(0, 1500))
      if (route === 'blog-post' && !hasAuthor) issues.push({ type: 'blog-post-missing-author-trust' })
      if (route === 'blog-post' && !hasDate) issues.push({ type: 'blog-post-missing-date' })
    }

    return { issues, positives }
  }, routeName)
}

async function checkMobileDrawer(page, viewport) {
  if (viewport !== 'mobile') return { opened: null, issues: [] }
  const issues = []
  let opened = false
  try {
    const menuBtn = page.getByRole('button', { name: /menu|navigation|open/i }).first()
    if (await menuBtn.isVisible({ timeout: 1500 })) {
      await menuBtn.click()
      await page.waitForTimeout(600)
      opened = true
      const navVisible = await page.locator('nav a, [role="dialog"] a, [data-state="open"] a').first().isVisible().catch(() => false)
      if (!navVisible) issues.push({ type: 'mobile-menu-no-links' })
      const overflow = await checkHorizontalOverflow(page)
      if (overflow.overflow) issues.push({ type: 'mobile-menu-horizontal-overflow', delta: overflow.delta })
      // close if possible
      const closeBtn = page.getByRole('button', { name: /close|menu/i }).first()
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) await closeBtn.click().catch(() => {})
    } else {
      issues.push({ type: 'mobile-menu-button-not-found' })
    }
  } catch (e) {
    issues.push({ type: 'mobile-menu-error', message: e.message.slice(0, 80) })
  }
  return { opened, issues }
}

async function checkReadability(page) {
  return page.evaluate(() => {
    const issues = []
    const h1s = [...document.querySelectorAll('h1')]
    if (h1s.length === 0) issues.push({ type: 'missing-h1' })
    if (h1s.length > 1) issues.push({ type: 'multiple-h1', count: h1s.length })

    const main = document.querySelector('main') || document.body
    const sample = main.querySelector('p') || main
    if (sample) {
      const style = getComputedStyle(sample)
      const fontSize = parseFloat(style.fontSize)
      const lineHeight = parseFloat(style.lineHeight) / fontSize
      if (fontSize < 14) issues.push({ type: 'small-body-text', px: fontSize })
      if (lineHeight > 0 && lineHeight < 1.35) issues.push({ type: 'tight-line-height', ratio: lineHeight.toFixed(2) })
    }

    // Low contrast heuristic on muted text
    const muted = document.querySelector('.text-muted-foreground, [class*="muted"]')
    if (muted) {
      const color = getComputedStyle(muted).color
      issues.push({ type: 'muted-text-present', color })
    }

    return issues
  })
}

function severityFor(issueType, route, viewport) {
  const p0 = ['broken-image', 'missing-email-field', 'missing-password-field', 'calculator-missing-inputs', 'reviews-page-no-review-content', 'mobile-menu-no-links']
  const p1 = ['horizontal-overflow', 'broker-profile-no-headshot', 'broker-profile-no-contact-path', 'photoless-person-card', 'unclear-account-heading', 'mobile-menu-button-not-found', 'large-empty-media-box', 'trust-page-cta-mismatch', 'blog-post-missing-author-trust']
  const p2 = ['vague-cta', 'vague-submit', 'unlabeled-input', 'small-touch-target', 'missing-h1', 'weak-about-headline', 'missing-license-broker-signal', 'mobile-menu-horizontal-overflow', 'small-body-text']
  if (p0.includes(issueType)) return 'P0'
  if (p1.includes(issueType)) return 'P1'
  if (p2.includes(issueType)) return 'P2'
  return 'P3'
}

function hurtsFor(issueType) {
  const map = {
    'horizontal-overflow': ['responsive', 'understanding'],
    'broken-image': ['trust', 'understanding'],
    'photoless-person-card': ['trust', 'understanding'],
    'large-empty-media-box': ['trust', 'understanding'],
    'broker-profile-no-headshot': ['trust', 'conversion'],
    'broker-profile-no-contact-path': ['trust', 'conversion'],
    'missing-license-broker-signal': ['trust'],
    'missing-local-anchor': ['trust', 'understanding'],
    'reviews-page-no-review-content': ['trust', 'conversion'],
    'vague-cta': ['conversion', 'understanding'],
    'trust-page-cta-mismatch': ['conversion', 'trust'],
    'unclear-account-heading': ['understanding', 'conversion'],
    'missing-email-field': ['conversion', 'understanding'],
    'missing-password-field': ['conversion', 'understanding'],
    'unlabeled-input': ['understanding', 'conversion'],
    'small-touch-target': ['responsive', 'conversion'],
    'mobile-menu-no-links': ['responsive', 'understanding'],
    'mobile-menu-button-not-found': ['responsive', 'understanding'],
    'mobile-menu-horizontal-overflow': ['responsive'],
    'calculator-missing-inputs': ['conversion', 'understanding'],
    'calculator-missing-action': ['conversion'],
    'blog-post-missing-author-trust': ['trust'],
    'blog-post-missing-date': ['trust', 'understanding'],
    'missing-h1': ['understanding'],
    'weak-about-headline': ['trust', 'understanding'],
    'small-body-text': ['readability', 'understanding'],
    'tight-line-height': ['readability'],
  }
  return map[issueType] || ['understanding']
}

async function discoverBlogPost(page) {
  await page.goto(`${BASE}/blog`, { waitUntil: 'load', timeout: 60000 })
  await dismissOverlays(page)
  await page.waitForTimeout(1200)
  const href = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/blog/"]')]
    const real = links.find((a) => {
      const h = a.getAttribute('href')
      return h && h !== '/blog' && !h.includes('#') && h.split('/').filter(Boolean).length >= 2
    })
    return real?.getAttribute('href') || null
  })
  return href
}

async function auditRoute(browser, routeDef, viewportKey) {
  const vp = VIEWPORTS[viewportKey]
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    } catch {}
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 180))
  })

  let routePath = routeDef.path
  if (routeDef.fallbackDiscover && routeDef.name === 'blog-post') {
    if (blogPostResolved) routePath = blogPostResolved
  }

  let status = 0
  let finalUrl = routePath
  try {
    const resp = await page.goto(`${BASE}${routePath}`, { waitUntil: 'load', timeout: 90000 })
    status = resp?.status() ?? 0
    finalUrl = new URL(page.url()).pathname

    if (routeDef.fallbackDiscover && status === 404) {
      const discovered = await discoverBlogPost(page)
      if (discovered) {
        blogPostResolved = discovered
        routePath = discovered
        const resp2 = await page.goto(`${BASE}${routePath}`, { waitUntil: 'load', timeout: 90000 })
        status = resp2?.status() ?? 0
        finalUrl = new URL(page.url()).pathname
      }
    }

    await dismissOverlays(page)
    await page.waitForTimeout(1400)

    if (status === 404) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: 'P0',
        category: 'route-error',
        issue: 'Page returned 404',
        hurts: ['understanding', 'trust'],
        evidence: { status, finalUrl },
      })
    } else if (status >= 500) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: 'P0',
        category: 'route-error',
        issue: `Page returned HTTP ${status}`,
        hurts: ['understanding', 'trust'],
        evidence: { status },
      })
    }

    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '')
    if (/Application error|Unhandled Runtime Error|Hydration failed/i.test(bodyText)) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: 'P0',
        category: 'runtime-error',
        issue: 'Visible application/runtime error on page',
        hurts: ['trust', 'understanding'],
        evidence: { snippet: bodyText.slice(0, 120) },
      })
    }

    const overflow = await checkHorizontalOverflow(page)
    if (overflow.overflow) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor('horizontal-overflow'),
        category: 'responsive',
        issue: `Horizontal overflow (${overflow.delta}px beyond viewport)`,
        hurts: hurtsFor('horizontal-overflow'),
        evidence: overflow,
      })
    }

    for (const issue of await checkPhotolessVoids(page)) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'visual-trust',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type),
        evidence: issue,
      })
    }

    for (const issue of await checkForms(page, routeDef.name)) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'forms',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type),
        evidence: issue,
      })
    }

    for (const issue of await checkCTAIntent(page, routeDef.name)) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'cta',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type),
        evidence: issue,
      })
    }

    const trust = await checkTrustSignals(page, routeDef.name)
    for (const issue of trust.issues) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'trust',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type),
        evidence: issue,
      })
    }

    for (const issue of await checkReadability(page)) {
      if (issue.type === 'muted-text-present') continue
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'readability',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type) || ['understanding'],
        evidence: issue,
      })
    }

    const drawer = await checkMobileDrawer(page, viewportKey)
    for (const issue of drawer.issues) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: severityFor(issue.type),
        category: 'mobile-nav',
        issue: issue.type.replace(/-/g, ' '),
        hurts: hurtsFor(issue.type),
        evidence: issue,
      })
    }

    if (consoleErrors.length) {
      addFinding({
        route: routeDef.name,
        path: routePath,
        viewport: viewportKey,
        severity: 'P2',
        category: 'console',
        issue: 'Browser console errors detected',
        hurts: ['trust'],
        evidence: { errors: [...new Set(consoleErrors)].slice(0, 5) },
      })
    }

    const shotName = `${routeDef.name}-${viewportKey}.png`
    await page.screenshot({ path: path.join(SHOT_DIR, shotName), fullPage: false }).catch(() => {})
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SHOT_DIR, `${routeDef.name}-${viewportKey}-mid.png`), fullPage: false }).catch(() => {})

    console.log(`${status >= 400 ? 'WARN' : 'OK  '} ${routeDef.name} @ ${viewportKey} [${status}] findings+${findings.filter((f) => f.route === routeDef.name && f.viewport === viewportKey).length}`)
  } catch (e) {
    addFinding({
      route: routeDef.name,
      path: routePath,
      viewport: viewportKey,
      severity: 'P0',
      category: 'navigation',
      issue: `Audit navigation failed: ${e.message.slice(0, 100)}`,
      hurts: ['understanding', 'trust'],
      evidence: {},
    })
    console.log(`FAIL ${routeDef.name} @ ${viewportKey}: ${e.message.slice(0, 80)}`)
  }

  await ctx.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // Pre-discover blog post if needed
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/blog/understanding-home-appraisals`, { waitUntil: 'load', timeout: 60000 }).catch(() => {})
    const status = (await page.goto(`${BASE}/blog/understanding-home-appraisals`, { waitUntil: 'load', timeout: 60000 }).catch(() => null))?.status()
    if (status === 404 || !status) {
      blogPostResolved = await discoverBlogPost(page)
      console.log('Blog post resolved to:', blogPostResolved)
    } else {
      blogPostResolved = '/blog/understanding-home-appraisals'
      console.log('Blog post OK:', blogPostResolved)
    }
    await ctx.close()
  }

  for (const route of ROUTES) {
    if (route.name === 'blog-post' && blogPostResolved) route.path = blogPostResolved
    for (const vp of ['desktop', 'mobile']) {
      await auditRoute(browser, route, vp)
    }
  }

  await browser.close()

  const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1

  const report = {
    meta: {
      auditDate: '2026-08-06',
      baseUrl: BASE,
      viewports: VIEWPORTS,
      routes: ROUTES.map((r) => r.path),
      blogPostResolved,
      screenshotDir: SHOT_DIR,
      method: 'Playwright chromium production sweep with cookie dismiss (Essential only + Maybe later)',
    },
    summary: {
      totalFindings: findings.length,
      bySeverity,
      routesAudited: ROUTES.length,
      viewportPasses: ROUTES.length * 2,
    },
    findings: findings.sort((a, b) => {
      const sev = { P0: 0, P1: 1, P2: 2, P3: 3 }
      return (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9)
    }),
  }

  const outFile = path.join(OUT_DIR, 'uiux-2026-08-06-trust.json')
  writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outFile}`)
  console.log(`Findings: ${findings.length} (P0:${bySeverity.P0} P1:${bySeverity.P1} P2:${bySeverity.P2} P3:${bySeverity.P3})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
