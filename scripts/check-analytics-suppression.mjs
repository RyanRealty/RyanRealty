#!/usr/bin/env node
/**
 * check-analytics-suppression.mjs — `ci:analytics-suppression`.
 *
 * Matt 2026-10-05: Google Analytics counts only real outside visitors; internal
 * users are excluded by login. The 2026-10-05 audit found our own traffic in the
 * production GA4 property from four directions (the capture tool granting
 * analytics consent behind a spoofed user agent, local production builds on
 * 127.0.0.1, ad-hoc headless probes, and GTM firing on /admin and for brokers).
 * The fix is one suppression decision (lib/analytics/ga-suppression.ts) read by
 * the browser tag loaders and the server mirror, plus an explicit automation
 * marker every browser this repo launches carries. This gate keeps each part
 * from drifting back:
 *
 *  1. No browser launcher outside the marker wrappers. Any file that takes
 *     `chromium` / `firefox` / `webkit` from 'playwright', 'playwright-core' or
 *     '@playwright/test', or anything from 'puppeteer' / 'puppeteer-core', must
 *     import scripts/lib/marked-playwright.mjs or scripts/lib/marked-puppeteer.mjs
 *     instead. Type-only imports are fine. Exempt: production renderers under
 *     lib/ that never navigate (no `.goto(`): they print HTML strings to PDF.
 *  2. Automation never grants analytics consent: no file outside the site's own
 *     consent code (app/, components/, lib/, public/) writes the consent cookie
 *     with analytics granted, or clicks the banner's "Accept all".
 *  3. The Playwright config plants the marker (automationStorageState).
 *  4. The browser loaders honor the decision: the GTM bootstrap gates gtm.js on
 *     GA_SUPPRESS_JS, GoogleAnalytics.tsx gates gtag.js on it, GTMHead re-applies
 *     it on navigation, and no other file under app/ or components/ requests
 *     gtm.js or gtag/js.
 *  5. The server mirror honors it: the track route decides with
 *     decideGaSuppressionForPage and the mirror condition reads it; the route
 *     refuses non-production pages before writing.
 *  6. The internal-user cookie is set by login: the auth callback and the admin
 *     layout's InternalBrowserMark; the marker cookie name in the scripts helper
 *     equals the site's.
 *
 * Exported `findViolations(files)` is unit-tested in
 * scripts/__tests__/check-analytics-suppression.test.mjs.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.claude',
  '.vercel',
  'out',
  'tmp',
  'scratchpad',
  'coverage',
  '_worktree_salvage',
  '_style_backup',
  'public',
])
const CODE_EXT = /\.(?:mjs|cjs|js|ts|mts|tsx)$/

const WRAPPERS = new Set(['scripts/lib/marked-playwright.mjs', 'scripts/lib/marked-puppeteer.mjs'])

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, out)
    else if (CODE_EXT.test(name) && !name.endsWith('.d.ts') && !name.endsWith('.d.mts')) out.push(full)
  }
  return out
}

/** Comments out, strings kept: an import in a docblock is not an import. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

const PW_PKGS = String.raw`(?:playwright|playwright-core|@playwright/test)`
const PP_PKGS = String.raw`(?:puppeteer|puppeteer-core)`
// `import { chromium, devices } from 'playwright'`, `import * as pw from 'playwright'`,
// `const { chromium } = require('playwright')`, `await import('playwright')`
const PW_LAUNCHER_NAMED = new RegExp(
  String.raw`import\s+\{([^}]*)\}\s+from\s+['"]${PW_PKGS}['"]|(?:const|let|var)\s+\{([^}]*)\}\s*=\s*(?:await\s+)?(?:require|import)\(\s*['"]${PW_PKGS}['"]\s*\)`,
  'g',
)
const PW_NAMESPACE = new RegExp(
  String.raw`import\s+\*\s+as\s+\w+\s+from\s+['"](?:playwright|playwright-core)['"]|import\s+\w+\s+from\s+['"](?:playwright|playwright-core)['"]|(?:require|import)\(\s*['"](?:playwright|playwright-core)['"]\s*\)(?!\s*\.\s*(?:Browser|Page|BrowserContext|Locator)\b)`,
)
const PP_VALUE = new RegExp(
  String.raw`import\s+(?!type\b)[\w{][^;]*?from\s+['"]${PP_PKGS}['"]|(?:require|import)\(\s*['"]${PP_PKGS}['"]\s*\)(?!\s*\.\s*(?:Browser|Page|BrowserContext|ElementHandle)\b)`,
)
const LAUNCHER_NAME = /\b(chromium|firefox|webkit)\b/

function launcherImports(code) {
  const hits = []
  PW_LAUNCHER_NAMED.lastIndex = 0
  let m
  while ((m = PW_LAUNCHER_NAMED.exec(code))) {
    const names = (m[1] ?? m[2] ?? '').split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type '))
    if (names.some((n) => LAUNCHER_NAME.test(n))) hits.push(m[0].replace(/\s+/g, ' '))
  }
  const ns = code.match(PW_NAMESPACE)
  if (ns) hits.push(ns[0].replace(/\s+/g, ' '))
  const pp = code.match(PP_VALUE)
  if (pp && !/^import\s+type\b/.test(pp[0])) hits.push(pp[0].replace(/\s+/g, ' '))
  return hits
}

const CONSENT_GRANT = [
  /ryan_realty_cookie_consent[\s\S]{0,300}?(?:analytics['"]?\s*:\s*true|%22analytics%22%3Atrue|\\?"analytics\\?"\s*:\s*true)/,
  /(?:analytics['"]?\s*:\s*true|%22analytics%22%3Atrue)[\s\S]{0,300}?ryan_realty_cookie_consent/,
]
const ACCEPT_ALL_CLICK = /(?:getByRole\([^)]*name:\s*\/?['"]?Accept all|text=Accept all|['"]Accept all['"][\s\S]{0,80}?\.click\(|hasText:\s*['"]Accept all)/i

/** Site code that legitimately reads or writes the consent answer a visitor gave. */
function isSiteConsentCode(rel) {
  return /^(?:app|components|lib|public|test)\//.test(rel) || /\.test\.(?:ts|tsx|mjs)$/.test(rel) || rel.startsWith('scripts/__tests__/')
}

/**
 * @param {Array<{ rel: string, src: string }>} files
 * @returns {string[]} violations
 */
export function findViolations(files) {
  const violations = []
  for (const { rel, src } of files) {
    if (rel === 'scripts/check-analytics-suppression.mjs' || rel === 'scripts/__tests__/check-analytics-suppression.test.mjs') continue
    const code = stripComments(src)
    if (!WRAPPERS.has(rel)) {
      const hits = launcherImports(code)
      if (hits.length) {
        const exemptRenderer = rel.startsWith('lib/') && !/\.goto\(/.test(code)
        if (!exemptRenderer) {
          violations.push(
            `${rel}: launches a browser without the automation marker (${hits[0]}). Import from scripts/lib/marked-playwright.mjs or scripts/lib/marked-puppeteer.mjs.`,
          )
        }
      }
    }
    if (!isSiteConsentCode(rel)) {
      if (CONSENT_GRANT.some((re) => re.test(code))) {
        violations.push(`${rel}: grants analytics consent in automation. Answer the banner with a decline ({ analytics: false, marketing: false }) to hide it.`)
      }
      if (ACCEPT_ALL_CLICK.test(code)) {
        violations.push(`${rel}: clicks the cookie banner's "Accept all" in automation. Decline it instead.`)
      }
    }
  }
  return violations
}

function read(rel) {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** Wiring checks on named files: each [file, regex, why]. */
export const WIRING = [
  ['lib/analytics/gtm-bootstrap.ts', /if\(!\$\{PRIVATE_PATH_JS\}&&!\$\{GA_SUPPRESS_JS\}\)\(function\(w,d,s,l,i\)/, 'the GTM bootstrap loads gtm.js without the suppression decision'],
  ['components/GTMHead.tsx', /gtmBootstrapScript\(/, 'GTMHead no longer renders the shared bootstrap'],
  ['components/GTMHead.tsx', /decideGaSuppression\(\{[\s\S]*?\}\)[\s\S]{0,200}?`ga-disable-\$\{GA4_ID\}`\]\s*=\s*decision\.suppress/, 'GTMHead no longer re-applies the decision on client-side navigation (ga-disable)'],
  ['components/GoogleAnalytics.tsx', /if \(!\$\{GA_SUPPRESS_JS\}\) \{[\s\S]*?googletagmanager\.com\/gtag\/js/, 'GoogleAnalytics.tsx requests gtag.js without the suppression decision'],
  ['app/api/visitors/track/route.ts', /const gaSuppression = decideGaSuppressionForPage\(/, 'the GA4 mirror no longer reads the shared suppression decision'],
  ['app/api/visitors/track/route.ts', /mirrorGa4 &&\s*!gaSuppression\.suppress &&/, 'the GA4 mirror condition no longer honors the suppression decision'],
  ['app/api/visitors/track/route.ts', /if \(isNonProductionPageLocation\(pageUrl\)\) \{\s*return NextResponse\.json\(/, 'the track route writes first-party visits from non-production hosts again'],
  ['app/api/visitors/track/route.ts', /marker: hasAutomationMarker\(/, 'the track route no longer flags our automation marker'],
  ['app/api/visitors/track/route.ts', /hasInternalUserCookie\(cookieHeader\)/, 'the track route no longer flags a signed-in broker browser'],
  ['app/auth/callback/route.ts', /await markInternalIfAdmin\(res, data\.user\.email, request\)/, 'the admin sign-in callback no longer sets the internal-user cookie'],
  ['app/admin/(protected)/layout.tsx', /<InternalBrowserMark \/>/, 'authenticated admin page loads no longer refresh the internal-user cookie'],
  ['components/admin/InternalBrowserMark.tsx', /fetch\('\/api\/admin\/internal-browser'/, 'the admin layout island no longer calls the internal-browser route'],
  ['app/api/admin/internal-browser/route.ts', /await markInternalBrowser\(\)/, 'the internal-browser route no longer sets the cookie through the role-checked action'],
  ['app/admin/login/_components/AdminLoginForm.tsx', /await markInternalBrowser\(\)/, 'One Tap admin sign-in no longer sets the internal-user cookie'],
  ['playwright.config.ts', /storageState: MARKED/, 'Playwright runs no longer carry the automation marker'],
  ['scripts/take-route-shots.mjs', /from '\.\/lib\/marked-playwright\.mjs'/, 'the capture tool launches without the automation marker'],
]

/** Files under app/ and components/ allowed to request a Google tag script. */
const TAG_LOADERS = new Set(['components/GoogleAnalytics.tsx', 'components/GTMBody.tsx'])

function main() {
  const violations = []
  const all = walk(ROOT, [])
  const files = all.map((f) => ({ rel: relative(ROOT, f).split('\\').join('/'), src: readFileSync(f, 'utf8') }))
  violations.push(...findViolations(files))

  for (const [rel, re, why] of WIRING) {
    const src = read(rel)
    if (src === null) violations.push(`${rel}: missing (${why})`)
    else if (!re.test(src)) violations.push(`${rel}: ${why}`)
  }

  for (const { rel, src } of files) {
    if (!/^(?:app|components)\//.test(rel) || TAG_LOADERS.has(rel) || /\.test\.tsx?$/.test(rel)) continue
    if (/googletagmanager\.com\/(?:gtm\.js|gtag\/js)/.test(stripComments(src))) {
      violations.push(`${rel}: requests a Google tag script outside the suppression-aware loaders (lib/analytics/gtm-bootstrap.ts, components/GoogleAnalytics.tsx)`)
    }
  }

  const tsSrc = read('lib/analytics/ga-suppression.ts') ?? ''
  const mjsSrc = read('scripts/lib/automation-marker.mjs') ?? ''
  const tsName = tsSrc.match(/export const AUTOMATION_MARKER_COOKIE = '([^']+)'/)?.[1]
  const mjsName = mjsSrc.match(/export const AUTOMATION_MARKER_COOKIE = '([^']+)'/)?.[1]
  if (!tsName || tsName !== mjsName) {
    violations.push(`the automation marker cookie differs between lib/analytics/ga-suppression.ts (${tsName}) and scripts/lib/automation-marker.mjs (${mjsName})`)
  }

  if (violations.length) {
    console.error(`ci:analytics-suppression FAILED (${violations.length}):`)
    for (const v of violations) console.error(`  - ${v}`)
    console.error('See lib/analytics/ga-suppression.ts and docs/TRACKING_POLICY.md "What GA4 counts".')
    process.exit(1)
  }
  console.log(`ci:analytics-suppression OK (${files.length} files scanned; ${WIRING.length} wiring checks)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
