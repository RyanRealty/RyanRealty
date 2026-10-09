/**
 * Read-only audit of stored CMA letters: the competition and unsold rows the
 * current renderer prints, against the rows the build stored.
 *
 * Fails when a blank place on the area the build drew is dropped, when a
 * delivered or finalized letter's printed rows are not the rows it was signed
 * with, or when a chapter says none while those rows print. A draft that
 * drops a named subdivision outside the sales plats is rule 24 and is
 * reported, not failed (3177 Coho).
 *
 * Also prints how many stored rows still lose every rival or every unsold
 * peer. That is the before/after count. A rule-24 draft can still be in it.
 *
 * READ-ONLY. Selects slug, status, render_args from cmas. Never writes.
 *
 *   npx tsx scripts/cma-render-audit.ts
 *   npx tsx scripts/cma-render-audit.ts cma-2902-pinnacle
 *   npm run cma:render-audit
 *
 * Not part of ci:gates: it reads production. Not part of cma:fleet: the fleet
 * builds fresh documents and never renders a stored row.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

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

import { createClient } from '@supabase/supabase-js'

type Row = { slug: string; status: string | null; render_args: unknown }

async function loadRows(): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase URL or service role key is not set')
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const out: Row[] = []
  const page = 200
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from('cmas')
      .select('slug, status, render_args')
      .order('slug', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}

async function main(): Promise<void> {
  const { auditCmaRenderRow } = await import('@/lib/cma/render-area-audit')
  const only = process.argv.slice(2).filter((a) => a.length > 0 && !a.startsWith('-'))
  const rows = (await loadRows()).filter((row) => row.render_args && typeof row.render_args === 'object')
  const scoped = only.length > 0 ? rows.filter((row) => only.includes(row.slug)) : rows
  let failN = 0
  let rule24N = 0
  let blankFail = 0
  let frozenFail = 0
  let zeroFail = 0
  let disagree = 0
  let loseRivals = 0
  let losePeers = 0
  let blankOther = 0
  let productN = 0
  let otherN = 0
  const loseRivalOther: string[] = []
  const losePeerOther: string[] = []
  const failLines: string[] = []
  const rule24Lines: string[] = []
  const otherLines: string[] = []
  for (const row of scoped) {
    const result = auditCmaRenderRow({ slug: row.slug, status: row.status, args: row.render_args })
    if (result.storedRivals > 0 && result.printedRivals === 0) {
      loseRivals += 1
      const tagged =
        result.fail.some((line) => line.includes(' rival ')) ||
        result.rule24.some((line) => line.includes(' rival ')) ||
        result.other.some((line) => line.includes(' rival '))
      if (!tagged) loseRivalOther.push(`${row.slug} ${row.status ?? 'draft'}`)
    }
    if (result.storedPeers > 0 && result.printedPeers === 0) {
      losePeers += 1
      const tagged =
        result.fail.some((line) => line.includes(' unsold ')) ||
        result.rule24.some((line) => line.includes(' unsold ')) ||
        result.other.some((line) => line.includes(' unsold '))
      if (!tagged) losePeerOther.push(`${row.slug} ${row.status ?? 'draft'}`)
    }
    if (result.fail.length === 0 && result.rule24.length === 0) continue
    failN += result.fail.length
    rule24N += result.rule24.length
    for (const line of result.fail) {
      if (line.includes('has no place')) blankFail += 1
      else if (line.includes('dropped on a')) frozenFail += 1
      else if (line.includes('says none')) zeroFail += 1
      else if (line.includes('map set disagrees')) disagree += 1
      failLines.push(line)
    }
    rule24Lines.push(...result.rule24)
    for (const line of result.other) {
      otherN += 1
      otherLines.push(line)
      if (line.includes('blank place on a different area')) blankOther += 1
      else if (line.includes(' product')) productN += 1
    }
  }
  console.log(`rows ${scoped.length}`)
  console.log(`lose-all-rivals ${loseRivals}`)
  console.log(`lose-all-unsold ${losePeers}`)
  if (loseRivalOther.length > 0) console.log(`lose-all-rivals-other ${loseRivalOther.join(', ')}`)
  if (losePeerOther.length > 0) console.log(`lose-all-unsold-other ${losePeerOther.join(', ')}`)
  console.log(`fail ${failN} (blank-place ${blankFail}, frozen ${frozenFail}, zero-sentence ${zeroFail}, map-disagree ${disagree})`)
  console.log(`rule24-named-outside ${rule24N}`)
  console.log(`other-drops ${otherN} (blank-other-area ${blankOther}, product ${productN}, rest ${otherN - blankOther - productN})`)
  for (const line of failLines) console.log(`FAIL ${line}`)
  for (const line of rule24Lines) console.log(`RULE24 ${line}`)
  for (const line of otherLines) console.log(`OTHER ${line}`)
  if (failN > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'audit failed')
  process.exit(1)
})
