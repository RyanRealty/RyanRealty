#!/usr/bin/env node
/**
 * Focused responsive layout audit — production site, Playwright measurements.
 * Usage: node scripts/_responsive-audit.mjs
 * Output: out/audits/uiux-2026-08-06-responsive.json
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const OUT_FILE = join('out', 'audits', 'uiux-2026-08-06-responsive.json')

const ROUTES = [
  '/',
  '/homes-for-sale/bend',
  '/homes-for-sale/bend/mtn-high/60643-thunderbird-220225319',
  '/sell',
  '/cities/bend',
  '/communities/tetherow',
  '/contact',
  '/team',
]

const VIEWPORTS = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
]

function cssPath(el) {
  if (!el || el.nodeType !== 1) return 'unknown'
  const parts = []
  let node = el
  while (node && node.nodeType === 1 && parts.length < 6) {
    let sel = node.tagName.toLowerCase()
    if (node.id) {
      sel += `#${node.id}`
      parts.unshift(sel)
      break
    }
    const cls = String(node.className || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
    if (cls.length) sel += '.' + cls.join('.')
    const parent = node.parentElement
    if (parent) {
      const siblings = [...parent.children].filter((c) => c.tagName === node.tagName)
      if (siblings.length > 1) sel += `:nth-of-type(${siblings.indexOf(node) + 1})`
    }
    parts.unshift(sel)
    node = node.parentElement
  }
  return parts.join(' > ')
}

async function dismissOverlays(page) {
  for (const label of ['Essential only', 'Maybe later', 'Decline', 'Reject all', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 250 })) await btn.click({ timeout: 800 })
    } catch {}
  }
}

/** Runs all layout checks in the browser context. */
function auditPageScript() {
  const W = window.innerWidth
  const H = window.innerHeight
  const findings = []

  const scrollOverflow = document.documentElement.scrollWidth - W
  if (scrollOverflow > 1) {
    findings.push({
      kind: 'doc-overflow',
      severity: scrollOverflow > 20 ? 'critical' : scrollOverflow > 8 ? 'high' : 'medium',
      title: `Document horizontal overflow ${scrollOverflow}px`,
      evidence: `scrollWidth=${document.documentElement.scrollWidth} innerWidth=${W}`,
      overflowPx: scrollOverflow,
    })
  }

  const isSrOnly = (el) => {
    const cls = String(el.className || '')
    if (/\bsr-only\b|\bvisually-hidden\b|\bscreen-reader\b/.test(cls)) return true
    const cs = getComputedStyle(el)
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clip === 'rect(0, 0, 0, 0)') return true
    if (cs.width === '1px' && cs.height === '1px' && cs.overflow === 'hidden') return true
    if (el.getAttribute('aria-hidden') === 'true') return true
    return false
  }

  const isVisible = (el) => {
    if (isSrOnly(el)) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
    return true
  }

  const clipped = (el) => {
    let p = el.parentElement
    while (p && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') return true
      p = p.parentElement
    }
    return false
  }

  // 2. Overflowing nodes
  const overflowNodes = []
  for (const el of document.querySelectorAll('*')) {
    if (!isVisible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > W + 1) {
      const cs = getComputedStyle(el)
      overflowNodes.push({
        selector: null, // filled below
        right: Math.round(r.right),
        width: Math.round(r.width),
        overflowPx: Math.round(r.right - W),
        position: cs.position,
        tag: el.tagName.toLowerCase(),
        className: String(el.className || '').slice(0, 80),
        clipped: clipped(el),
        fixedOrSticky: cs.position === 'fixed' || cs.position === 'sticky',
      })
    }
  }
  overflowNodes.sort((a, b) => b.overflowPx - a.overflowPx)
  const contributors = overflowNodes.filter((n) => !n.clipped && !n.fixedOrSticky).slice(0, 8)
  for (const n of contributors) {
    findings.push({
      kind: 'node-overflow',
      severity: n.overflowPx > 40 ? 'critical' : n.overflowPx > 16 ? 'high' : 'medium',
      title: `${n.tag} overflows viewport by ${n.overflowPx}px`,
      evidence: `right=${n.right}px width=${n.width}px pos=${n.position} class="${n.className}"`,
      overflowPx: n.overflowPx,
      tag: n.tag,
      className: n.className,
    })
  }

  // 3. Fixed/sticky bars
  const fixedEls = [...document.querySelectorAll('*')].filter((el) => {
    if (!isVisible(el)) return false
    const pos = getComputedStyle(el).position
    return pos === 'fixed' || pos === 'sticky'
  })
  const topBars = fixedEls.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.top <= 4 && r.height >= 24 && r.width >= W * 0.5
  })
  const bottomBars = fixedEls.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom >= H - 4 && r.height >= 24 && r.width >= W * 0.4
  })

  if (topBars.length > 1) {
    findings.push({
      kind: 'sticky-stack',
      severity: 'high',
      title: `${topBars.length} fixed/sticky top bars may stack`,
      evidence: topBars
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 40)} h=${Math.round(el.getBoundingClientRect().height)}`)
        .join('; '),
    })
  }
  if (bottomBars.length > 1) {
    const totalH = bottomBars.reduce((s, el) => s + el.getBoundingClientRect().height, 0)
    findings.push({
      kind: 'sticky-stack',
      severity: totalH > H * 0.35 ? 'critical' : 'high',
      title: `${bottomBars.length} fixed/sticky bottom bars (${Math.round(totalH)}px combined)`,
      evidence: bottomBars
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 40)} h=${Math.round(el.getBoundingClientRect().height)}`)
        .join('; '),
    })
  }
  // Content covered by fixed bars
  const main = document.querySelector('main') || document.querySelector('[role="main"]')
  if (main && bottomBars.length) {
    const mainR = main.getBoundingClientRect()
    const bottomTop = Math.min(...bottomBars.map((el) => el.getBoundingClientRect().top))
    if (mainR.bottom > bottomTop + 8 && mainR.bottom <= H + 40) {
      findings.push({
        kind: 'content-covered',
        severity: 'high',
        title: 'Main content bottom obscured by fixed bar(s)',
        evidence: `main bottom=${Math.round(mainR.bottom)} bar top=${Math.round(bottomTop)} viewport=${H}`,
      })
    }
  }

  // 4. Text truncated unreadably
  const textEls = [...document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, label, button, td, th')]
  let truncCount = 0
  for (const el of textEls) {
    if (!isVisible(el)) continue
    const cs = getComputedStyle(el)
    const text = (el.textContent || '').trim()
    if (text.length < 8) continue
    const r = el.getBoundingClientRect()
    if (r.width < 28 && text.length > 12) {
      truncCount++
      if (truncCount <= 5) {
        findings.push({
          kind: 'text-truncated',
          severity: r.width < 20 ? 'critical' : 'high',
          title: `Text squeezed to ${Math.round(r.width)}px width`,
          evidence: `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
          width: Math.round(r.width),
        })
      }
    }
    if (
      (cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') &&
      el.scrollWidth > el.clientWidth + 4 &&
      r.width < 120 &&
      text.length > 20
    ) {
      truncCount++
      if (truncCount <= 8) {
        findings.push({
          kind: 'text-ellipsis',
          severity: r.width < 80 ? 'high' : 'medium',
          title: `Ellipsis hides text in ${Math.round(r.width)}px container`,
          evidence: `"${text.slice(0, 50)}…" scroll=${el.scrollWidth} client=${el.clientWidth}`,
          width: Math.round(r.width),
        })
      }
    }
  }

  // 5. Tables/maps not collapsing
  for (const table of document.querySelectorAll('table')) {
    if (!isVisible(table)) continue
    const r = table.getBoundingClientRect()
    if (r.width > W + 1 || table.scrollWidth > W) {
      findings.push({
        kind: 'table-overflow',
        severity: r.width > W + 40 ? 'critical' : 'high',
        title: `Table wider than viewport (${Math.round(r.width)}px)`,
        evidence: `table scrollWidth=${table.scrollWidth} viewport=${W}`,
      })
    }
  }
  for (const map of document.querySelectorAll('[class*="map"], .gm-style, iframe[src*="google"], [data-map]')) {
    if (!isVisible(map)) continue
    const r = map.getBoundingClientRect()
    if (r.right > W + 8 || r.width > W + 8) {
      findings.push({
        kind: 'map-overflow',
        severity: r.width > W + 40 ? 'critical' : 'high',
        title: `Map/container overflows (${Math.round(r.width)}px wide)`,
        evidence: `right=${Math.round(r.right)} width=${Math.round(r.width)}`,
      })
    }
  }

  // 6. Font overflowing containers
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, a, span, button')) {
    if (!isVisible(el)) continue
    const text = (el.textContent || '').trim()
    if (text.length < 4) continue
    if (el.scrollWidth > el.clientWidth + 6 && el.clientWidth > 0) {
      const r = el.getBoundingClientRect()
      if (r.width < W * 0.95) {
        findings.push({
          kind: 'font-overflow',
          severity: el.scrollWidth - el.clientWidth > 24 ? 'high' : 'medium',
          title: `Text overflows container by ${el.scrollWidth - el.clientWidth}px`,
          evidence: `"${text.slice(0, 40)}" scroll=${el.scrollWidth} client=${el.clientWidth}`,
          width: Math.round(r.width),
        })
        if (findings.filter((f) => f.kind === 'font-overflow').length >= 6) break
      }
    }
  }

  // 7. Tap targets < 40px (mobile only — caller passes flag)
  return {
    scrollOverflow,
    findings,
    overflowNodes: contributors,
    topBarCount: topBars.length,
    bottomBarCount: bottomBars.length,
  }
}

function enrichWithSelectors(pageFindings, selectorMap) {
  return pageFindings.map((f, i) => {
    if (f.kind === 'node-overflow' && selectorMap[i]) return { ...f, selector: selectorMap[i] }
    return f
  })
}

const allFindings = []
let overflowCount = 0
let criticalCount = 0

const browser = await chromium.launch({ headless: true })

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const viewportLabel = `${vp.width}x${vp.height}`
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
        localStorage.setItem('ryan_realty_cookie_consent', 'essential')
      } catch {}
    })
    const page = await ctx.newPage()
    const routeFindings = []

    try {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 90000 })
      const status = resp?.status() ?? 0
      if (status >= 400) {
        routeFindings.push({
          route,
          viewport: viewportLabel,
          severity: 'critical',
          title: `Route returned HTTP ${status}`,
          evidence: `${BASE}${route}`,
          fix: 'Fix server/route error before layout audit',
        })
      } else {
        await dismissOverlays(page)
        await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
        await page.waitForTimeout(1200)

        // Scroll to prime lazy content
        await page.evaluate(async (vh) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
          let h = document.body.scrollHeight
          for (let y = 0; y < Math.min(h, vh * 6); y += Math.round(vh * 0.85)) {
            window.scrollTo(0, y)
            await sleep(100)
          }
          window.scrollTo(0, 0)
          await sleep(300)
        }, vp.height)
        await dismissOverlays(page)
        await page.waitForTimeout(400)

        const audit = await page.evaluate(auditPageScript)

        if (audit.scrollOverflow > 1) overflowCount++

        for (const f of audit.findings) {
          if (f.severity === 'critical') criticalCount++
          routeFindings.push({
            route,
            viewport: viewportLabel,
            severity: f.severity,
            title: f.title,
            evidence: f.evidence,
            selector: f.selector,
            fix: suggestFix(f),
          })
        }

        // Tap targets on 320/390 only
        if (vp.width <= 390) {
          const smallTargets = await page.evaluate(() => {
            const W = window.innerWidth
            const out = []
            const candidates = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"], label[for]')
            for (const el of candidates) {
              const cls = String(el.className || '')
              if (/\bsr-only\b|\bvisually-hidden\b/.test(cls)) continue
              const cs = getComputedStyle(el)
              if (cs.display === 'none' || cs.visibility === 'hidden') continue
              const r = el.getBoundingClientRect()
              if (r.width < 1 || r.height < 1) continue
              if (r.bottom < 0 || r.top > window.innerHeight) continue
              const minDim = Math.min(r.width, r.height)
              if (minDim < 40) {
                out.push({
                  tag: el.tagName.toLowerCase(),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
                  className: String(el.className || '').slice(0, 60),
                })
              }
            }
            out.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h))
            return out.slice(0, 12)
          })

          if (smallTargets.length) {
            const worst = smallTargets[0]
            const sev = Math.min(worst.w, worst.h) < 32 ? 'critical' : 'high'
            if (sev === 'critical') criticalCount++
            routeFindings.push({
              route,
              viewport: viewportLabel,
              severity: sev,
              title: `${smallTargets.length} tap target(s) under 40px`,
              evidence: `worst: ${worst.tag} ${worst.w}x${worst.h}px "${worst.text}" .${worst.className}`,
              fix: 'Increase hit area to min 44x44px or add padding on mobile',
            })
          }
        }
      }
    } catch (err) {
      routeFindings.push({
        route,
        viewport: viewportLabel,
        severity: 'critical',
        title: 'Audit failed',
        evidence: err instanceof Error ? err.message : String(err),
        fix: 'Investigate timeout or page crash',
      })
      criticalCount++
    }

    allFindings.push(...routeFindings)
    const bad = routeFindings.filter((f) => f.severity !== 'low')
    console.log(
      `${bad.length ? 'ISSUE' : 'OK   '} ${route.padEnd(55)} ${viewportLabel} (${routeFindings.length} findings)`,
    )
    await ctx.close()
  }
}

await browser.close()

function suggestFix(f) {
  switch (f.kind) {
    case 'doc-overflow':
    case 'node-overflow':
      return 'Add overflow-x-hidden on root or fix width:100vw/max-width on offending component; use min(100%, ...) for full-bleed sections'
    case 'sticky-stack':
    case 'content-covered':
      return 'Consolidate fixed/sticky CTAs; add scroll-padding-bottom equal to sticky bar height'
    case 'text-truncated':
    case 'text-ellipsis':
      return 'Allow wrap/stack on narrow viewports; reduce side padding or use smaller type scale'
    case 'table-overflow':
      return 'Wrap table in overflow-x-auto container or stack cells on mobile'
    case 'map-overflow':
      return 'Constrain map wrapper to 100% width with overflow hidden'
    case 'font-overflow':
      return 'Use break-words/hyphens or reduce font-size at this breakpoint'
    default:
      return 'Review component at this breakpoint'
  }
}

// Dedupe similar findings per route+viewport
const deduped = []
const seen = new Set()
for (const f of allFindings) {
  const key = `${f.route}|${f.viewport}|${f.title}|${f.evidence?.slice(0, 40)}`
  if (seen.has(key)) continue
  seen.add(key)
  deduped.push(f)
}

criticalCount = deduped.filter((f) => f.severity === 'critical').length
overflowCount = deduped.filter((f) =>
  /overflow|wider than viewport|scrollWidth/i.test(f.title + f.evidence),
).length

const report = {
  summary: {
    routesChecked: ROUTES.length,
    viewportsChecked: VIEWPORTS.length,
    overflowCount,
    criticalCount,
    totalFindings: deduped.length,
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
  },
  findings: deduped,
}

mkdirSync(join('out', 'audits'), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(report, null, 2))
console.log(`\nWrote ${OUT_FILE}`)
console.log(
  `Summary: ${report.summary.routesChecked} routes × ${report.summary.viewportsChecked} viewports, ${report.summary.totalFindings} findings, ${overflowCount} overflow, ${criticalCount} critical`,
)

// Top 10 worst for parent agent
const severityRank = { critical: 0, high: 1, medium: 2, low: 3 }
const top10 = [...deduped]
  .sort((a, b) => {
    const sd = severityRank[a.severity] - severityRank[b.severity]
    if (sd !== 0) return sd
    const overflowA = /(\d+)px/.exec(a.evidence || '')?.[1] ?? 0
    const overflowB = /(\d+)px/.exec(b.evidence || '')?.[1] ?? 0
    return Number(overflowB) - Number(overflowA)
  })
  .slice(0, 10)

console.log('\n=== TOP 10 WORST RESPONSIVE BUGS ===')
top10.forEach((f, i) => {
  console.log(`${i + 1}. [${f.severity.toUpperCase()}] ${f.route} @ ${f.viewport}`)
  console.log(`   ${f.title}`)
  console.log(`   ${f.evidence}`)
  if (f.fix) console.log(`   Fix: ${f.fix}`)
})
