#!/usr/bin/env node
/**
 * check-admin-nav-source.mjs — ONE admin nav source, mechanically held.
 *
 * Pain #3 of the admin rebuild (2026-07-17, D9): the admin used to run EIGHT
 * coexisting nav systems — a 56-item two-pass regroup that bypassed role gating
 * (≥4 dead-end regressions), a hardcoded mobile tab array, and a 4-entry
 * command-palette list with labels for a deleted shell. The fix made
 * lib/admin/nav.ts DESTINATIONS the single capability-projected source for the
 * desktop bar, the mobile sheet, the bottom tab bar, and the ⌘K palette.
 * This gate keeps it that way:
 *
 *   1. NO consumer carries its own /admin route list. The shell adapter
 *      (admin-nav.ts), the tab bar, the palette, and the §5 desktop rail
 *      primitive (RailNav, B5) must contain zero `href: '/admin...'` literals —
 *      routes live ONLY in lib/admin/nav.ts.
 *   2. Every href in DESTINATIONS resolves to a real page under
 *      app/admin/(protected)/ — the nav can never point at a dead route.
 *   3. The palette mounts ONCE (ConsoleShell); every other chrome surface
 *      (phone utility row, rail top slot) renders only the trigger. The old
 *      double-mount registered two ⌘K listeners and stacked two dialogs
 *      (audit §9.2). The rail primitive may not mount or import it.
 *
 * Usage: node scripts/check-admin-nav-source.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const fails = []

function read(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    fails.push(`${file}: missing — the one-nav-source contract expects it`)
    return null
  }
}

// ── 1. No consumer-owned /admin route lists ─────────────────────────────────
const NO_ROUTE_LITERALS = [
  'app/components/admin/admin-nav.ts',
  'components/console/CrmMobileTabBar.tsx',
  'components/console/ConsoleCommandPalette.tsx',
  // B5: the §5 desktop rail is a pure primitive — nav data reaches it only
  // through props from the one source.
  'components/admin/v2/RailNav.tsx',
]
const HREF_LITERAL = /href:\s*['"`]\/admin/
for (const file of NO_ROUTE_LITERALS) {
  const src = read(file)
  if (src && HREF_LITERAL.test(src)) {
    fails.push(`${file}: contains an \`href: '/admin...'\` literal — admin routes live ONLY in lib/admin/nav.ts DESTINATIONS`)
  }
}

// ── 2. Every DESTINATIONS href resolves to a real page ──────────────────────
const navSrc = read('lib/admin/nav.ts')
if (navSrc) {
  const hrefs = new Set()
  const HREF_RE = /href:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = HREF_RE.exec(navSrc)) !== null) hrefs.add(m[1])
  if (hrefs.size === 0) fails.push('lib/admin/nav.ts: no hrefs found — DESTINATIONS parse failed?')
  for (const href of hrefs) {
    if (!href.startsWith('/admin')) {
      fails.push(`lib/admin/nav.ts: href ${href} is not an /admin route`)
      continue
    }
    const rel = href === '/admin' ? '' : href.slice('/admin/'.length)
    const page = rel ? `app/admin/(protected)/${rel}/page.tsx` : 'app/admin/(protected)/page.tsx'
    if (!existsSync(page)) {
      fails.push(`lib/admin/nav.ts: href ${href} has no page at ${page} — the nav may not point at a dead route`)
    }
  }
}

// ── 4. Every RESTRICTED nav capability is ENFORCED on its page (kills the RC5
//       class: nav hides an item but the page still loads it by URL). For each
//       nav href whose capability excludes a role (superuser-only, or excludes
//       report_viewer), the page must enforce it via one of:
//        (a) requireAdminPage('<cap>') in the page.tsx (the canonical guard),
//        (b) an inline role redirect in the page (role !== 'superuser' / report_viewer),
//        (c) a parent layout.tsx with a role redirect,
//        (d) an explicit allowlist entry (client pages guarded at the action layer).
//       Enforced 2026-07-17 after the audit found 22 nav-vs-page mismatches. ──
const capsSrc = read('lib/admin/capabilities.ts')
const CAP_ROLES = {}
if (capsSrc) {
  const body = capsSrc.slice(capsSrc.indexOf('CAPABILITY_ROLES'))
  const RE = /'([\w.]+)':\s*\[([^\]]*)\]/g
  let mm
  while ((mm = RE.exec(body)) !== null) {
    CAP_ROLES[mm[1]] = mm[2].match(/'([\w_]+)'/g)?.map((s) => s.replace(/'/g, '')) ?? []
  }
}
// Pages whose enforcement lives elsewhere than a same-file requireAdminPage /
// inline role check / parent layout — documented so a NEW restricted route
// can't silently join without a guard.
const ENFORCEMENT_ALLOWLIST = {
  '/admin/blog': 'client page; content.blog guard on getAdminBlogPosts + all blog writes (app/actions/blog.ts)',
  '/admin/guides': 'client page; content.guides guard on getAdminGuides + all guide writes (app/actions/guides.ts)',
}
if (capsSrc && navSrc) {
  // Parse nav href → capability pairs from DESTINATIONS.
  const pairs = []
  const ITEM_RE = /href:\s*'([^']+)'[^}]*?capability:\s*'([\w.]+)'/g
  let pm
  while ((pm = ITEM_RE.exec(navSrc)) !== null) pairs.push({ href: pm[1], cap: pm[2] })
  const hasRoleRedirect = (src) =>
    /!==\s*'superuser'|===\s*'report_viewer'|requireAdminPage\(|requireSuperuser|role\s*!==\s*'superuser'/.test(src)
  for (const { href, cap } of pairs) {
    const roles = CAP_ROLES[cap]
    if (!roles) { fails.push(`nav href ${href} → capability '${cap}' is not in CAPABILITY_ROLES`); continue }
    const restricted = !(roles.includes('broker') && roles.includes('report_viewer'))
    if (!restricted) continue // all-admin cap (today.view / settings.account) — page needs no gate
    if (ENFORCEMENT_ALLOWLIST[href]) continue
    const rel = href === '/admin' ? '' : href.slice('/admin/'.length)
    const page = rel ? `app/admin/(protected)/${rel}/page.tsx` : 'app/admin/(protected)/page.tsx'
    const pageSrc = existsSync(page) ? readFileSync(page, 'utf8') : ''
    // Canonical: page calls requireAdminPage('<this cap>'). Accept an inline role
    // redirect or a parent layout gate as equivalent enforcement.
    let enforced = pageSrc.includes(`requireAdminPage('${cap}')`) || hasRoleRedirect(pageSrc)
    if (!enforced) {
      // walk parent segments for a gating layout.tsx
      const segs = rel.split('/')
      for (let i = segs.length; i > 0 && !enforced; i--) {
        const layout = `app/admin/(protected)/${segs.slice(0, i).join('/')}/layout.tsx`
        if (existsSync(layout) && hasRoleRedirect(readFileSync(layout, 'utf8'))) enforced = true
      }
    }
    if (!enforced) {
      fails.push(`nav href ${href} → '${cap}' (roles ${JSON.stringify(roles)}) is RESTRICTED but its page enforces nothing — add requireAdminPage('${cap}') to ${page} (RC5 class). If guarded elsewhere, allowlist it in check-admin-nav-source.mjs.`)
    }
  }
}

// ── 3. Single palette mount ─────────────────────────────────────────────────
const rail = read('components/admin/v2/RailNav.tsx')
if (rail && /ConsoleCommandPalette/.test(rail)) {
  fails.push('components/admin/v2/RailNav.tsx: references ConsoleCommandPalette — only ConsoleShell mounts the palette; the rail receives the trigger through its `top` slot')
}
const shell = read('components/console/ConsoleShell.tsx')
if (shell) {
  const mounts = (shell.match(/<ConsoleCommandPalette[\s/>]/g) ?? []).length
  if (mounts !== 1) {
    fails.push(`components/console/ConsoleShell.tsx: ${mounts} ConsoleCommandPalette mounts — exactly 1 required (one ⌘K listener, one dialog)`)
  }
}

console.log('Admin nav one-source gate')
console.log('=========================')
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('All contracts hold: no consumer route lists, every nav href resolves to a live page, one palette mount.')
