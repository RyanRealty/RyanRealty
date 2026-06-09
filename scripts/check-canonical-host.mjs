#!/usr/bin/env node
/**
 * Canonical-host redirect gate.
 *
 * The site answers on multiple public hosts (the apex ryan-realty.com, the
 * Vercel alias ryanrealty.vercel.app, and www.ryan-realty.com). @supabase/ssr
 * writes the PKCE code_verifier as a HOST-ONLY cookie on whichever host the
 * visitor starts on, but Supabase Auth always redirects the OAuth callback to
 * the host in its Site URL. Start on the alias, get the callback on the apex,
 * and exchangeCodeForSession throws "code verifier could not be found" — the
 * user bounces to /auth-error and NO Follow Up Boss lead is created. This broke
 * every Google/Facebook sign-in that initiated on the alias (root-caused
 * 2026-06-02; www added 2026-06-03).
 *
 * The fix is middleware.ts funneling every PAGE request on a non-canonical host
 * to the apex with a 308, BEFORE anything else, and NEVER touching /api/* (so
 * server-to-server callers on the alias keep working). If that block regresses
 * — alias dropped from the set, 308 removed, /api/ exclusion lost — sign-in
 * silently breaks site-wide and leads stop. This gate locks each of those.
 *
 * Companion memory: ryanrealty-oauth-dual-host.md. Invariant as a gate, not prose.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MW = path.join(ROOT, 'middleware.ts')

const fail = (msg) => {
  console.error('Canonical-host gate FAILED:')
  console.error('  - ' + msg)
  process.exit(1)
}

if (!fs.existsSync(MW)) fail('middleware.ts is missing — the canonical-host redirect lives there.')
const src = fs.readFileSync(MW, 'utf8')

// 1. The canonical host must be the apex.
if (!/CANONICAL_HOST\s*=\s*['"]ryan-realty\.com['"]/.test(src)) {
  fail("middleware.ts must define CANONICAL_HOST = 'ryan-realty.com'.")
}

// 2. Both known non-canonical public hosts must be funneled. Missing either one
//    reopens the exact PKCE failure (alias = 2026-06-02, www = 2026-06-03).
const setMatch = src.match(/NON_CANONICAL_HOSTS\s*=\s*new Set\(\[([^\]]*)\]/)
if (!setMatch) fail('middleware.ts must define NON_CANONICAL_HOSTS as a Set of aliases to funnel.')
const setBody = setMatch[1]
for (const required of ['ryanrealty.vercel.app', 'www.ryan-realty.com']) {
  if (!setBody.includes(required)) {
    fail(`NON_CANONICAL_HOSTS must include '${required}' — dropping it reopens the OAuth PKCE break.`)
  }
}

// 3. The redirect must be a 308 (preserves method + is permanent for SEO),
//    guarded on the non-canonical set AND excluding /api/* (server-to-server
//    callers on the alias must not be redirected).
const guardOk =
  /NON_CANONICAL_HOSTS\.has\(host\)\s*&&\s*!pathname\.startsWith\(['"]\/api\/['"]\)/.test(src)
if (!guardOk) {
  fail(
    'the canonical-host redirect must be guarded by `NON_CANONICAL_HOSTS.has(host) && ' +
      "!pathname.startsWith('/api/')` — without the /api/ exclusion, webhooks/crons on the alias break.",
  )
}
if (!/NextResponse\.redirect\([^)]*,\s*308\)/.test(src)) {
  fail('the canonical-host redirect must use a 308 (NextResponse.redirect(url, 308)).')
}

console.log('Canonical-host gate passed (apex canonical, alias + www funneled via 308, /api/ excluded).')
