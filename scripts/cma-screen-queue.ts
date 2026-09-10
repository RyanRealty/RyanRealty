/**
 * Pull the prospects we may not solicit out of the queue (Matt 2026-09-09:
 * "for-sale-by-owners that are listed on the MLS or expired listings that
 * either sold since they came off the market or are currently listed… just
 * pull them right out of the queue").
 *
 * Silent by design: the row is archived with the reason recorded on it, no
 * notification, no message to anyone. An unverified row is left alone — a
 * failed MLS read must never archive a live prospect.
 *
 *   npx tsx scripts/cma-screen-queue.ts            # report only
 *   npx tsx scripts/cma-screen-queue.ts --archive  # pull them
 *   npx tsx scripts/cma-screen-queue.ts --restore  # re-screen the ones it pulled
 *                                                  and put back any that now pass
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const rf = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return rf.call(this, req, ...args)
}

async function main() {
  const archive = process.argv.includes('--archive')
  const restore = process.argv.includes('--restore')
  if (restore) {
    await restorePulled()
    return
  }
  const { runSolicitSweep } = await import('@/lib/cma/solicit-sweep')
  const out = await runSolicitSweep({ archive })
  if (out.error) {
    console.error(`UNREADABLE: ${out.error} — refusing to report a clean screen.`)
    process.exit(2)
  }
  for (const s of out.slugs) console.log(`${s.reason.toUpperCase().padEnd(8)} ${s.slug.padEnd(40)} ${s.address}`)
  console.log(
    `\nscreened ${out.screened} · clear ${out.clear} · sold ${out.byReason.sold} · listed ${out.byReason.listed} · pending ${out.byReason.pending} · unverified ${out.byReason.unverified}`,
  )
  console.log(archive ? `pulled ${out.pulled} row(s) from the queue.` : 'report only. Pass --archive to pull them.')
}

/**
 * Put back a row this screen pulled that a corrected rule now clears. The
 * first live run measured "sold since" against nothing and read a 2011 sale as
 * a reason to skip a 2026 expired owner; this undoes that class without
 * touching rows archived for any other reason.
 */
async function restorePulled() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { updateCmaRowFieldsBySlug, getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { screenAddressForSolicitation } = await import('@/lib/cma/solicit-screen')
  const { rows } = await listCmaQueue({ limit: 500, includeArchived: true })
  const pulled: Array<{ slug: string; address: string; reason: string }> = []
  for (const r of rows) {
    if (r.state !== 'archived') continue
    const row = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const screenRec = ((row?.build_summary ?? {}) as Record<string, unknown>).solicit_screen as
      | Record<string, unknown>
      | undefined
    if (!screenRec) continue
    pulled.push({ slug: r.slug, address: String(r.address), reason: String(screenRec.reason) })
  }
  if (pulled.length === 0) {
    console.error('UNREADABLE: no rows carry a solicit_screen record — refusing to report an empty restore.')
    process.exit(2)
  }
  let back = 0
  for (const p of pulled) {
    const row = (await getCmaAdminRowBySlug(p.slug)) as Record<string, unknown> | null
    const screen = await screenAddressForSolicitation({
      address: (row?.subject_address as string | null) ?? p.address,
      city: (row?.subject_city as string | null) ?? null,
      subjectListingKey: (row?.subject_listing_key as string | null) ?? null,
    })
    // A restore needs a POSITIVE clearance: cleared, having actually read
    // listings for the address. "No MLS listing on record" for a prospect that
    // came from the MLS is a resolution failure, not a clearance.
    if (!screen.ok || screen.checked === 0) continue
    const summary = { ...((row?.build_summary ?? {}) as Record<string, unknown>) }
    delete summary.solicit_screen
    const res = await updateCmaRowFieldsBySlug(p.slug, { archived_at: null, build_summary: summary })
    if (res.ok) {
      back++
      console.log(`restored ${p.slug.padEnd(38)} was ${p.reason} · ${screen.detail.slice(0, 70)}`)
    }
  }
  console.log(`\nre-screened ${pulled.length} pulled row(s); restored ${back}.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
