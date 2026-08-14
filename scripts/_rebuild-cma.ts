/**
 * One-off: rebuild a single CMA by slug, from the CLI.
 *
 * WHY THIS EXISTS. The only rebuild path is rebuildCmaAction, behind admin
 * Google OAuth. Verifying a change to the CMA generator therefore required a
 * human to sign in and click, which is not a thing an agent can or should do.
 * This mirrors rebuildCmaAction's buildCma() call exactly — same fields, same
 * requestSource semantics — so a CLI rebuild and an admin rebuild produce the
 * same document.
 *
 * It writes to the live cmas row, exactly as the admin button does, and returns
 * the document to draft for a fresh review. It cannot send anything.
 *
 *   npx tsx scripts/_rebuild-cma.ts cma-20513-byron
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

// `server-only` throws by design outside a Next server component, and lib/data
// imports it. vitest.config.ts solves this with an alias to
// test/server-only-stub.ts; a CLI has no bundler to alias with, so the same
// stub is substituted at resolve time. Everything below is dynamically imported
// AFTER the hook is installed, because a static import would hoist above it.
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

async function main() {
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { buildCma } = await import('@/lib/cma/build')

  const slug = (process.argv[2] ?? '').trim().toLowerCase()
  if (!slug) {
    console.error('usage: npx tsx scripts/_rebuild-cma.ts <slug>')
    process.exit(1)
  }

  const row = await getCmaAdminRowBySlug(slug)
  if (!row) {
    console.error(`✖ no cmas row for slug "${slug}"`)
    process.exit(1)
  }

  console.log(`Rebuilding ${slug} — ${String(row.subject_address ?? '(no address)')}`)
  const started = Date.now()

  const result = await buildCma({
    slug,
    mlsNumber: (row.subject_listing_key as string | null) ?? null,
    rawAddress: (row.subject_address as string | null) ?? null,
    city: (row.subject_city as string | null) ?? null,
    client: {
      name: (row.client_name as string | null)?.trim() || null,
      email: (row.client_email as string | null)?.trim().toLowerCase() || null,
      phone: (row.client_phone as string | null)?.trim() || null,
      notes: (row.client_notes as string | null) ?? null,
    },
    brokerSlug: (row.broker_slug as string | null) ?? null,
    priceOverride: null,
    requestSource: 'cli-rebuild',
    docType: (row.doc_type as string | null) === 'expired-audit' ? 'expired-audit' : 'cma',
  })

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (!result.ok) {
    console.error(`✖ build failed after ${secs}s: ${result.error}`)
    process.exit(1)
  }
  console.log(`✓ rebuilt ${slug} in ${secs}s`)
}

main().catch((e) => {
  console.error('✖ rebuild threw:', e)
  process.exit(1)
})
