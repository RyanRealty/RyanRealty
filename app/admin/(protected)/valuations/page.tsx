// @no-parity — internal admin surface, no public mockup contract
// Valuations (P9 roll:remaining-families, IA lock 2026-08-05): get valuation
// documents built, reviewed, delivered — CMAs + broker price opinions as ONE
// worklist over the one build engine (P3 lock: bpo-deliver MERGE→cma-deliver
// surface; keep the docType, kill the second worklist). Expired-audit docs are
// prospecting-owned and surface on the Prospecting worklist, not here. The
// per-doc review/send machinery stays on /admin/cmas/[slug] and /admin/bpo —
// one tap away — until it migrates.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listCmasForAdmin } from '@/lib/data'
import { listBposForAdmin } from '@/lib/data/bpo/reads'
import { formatDate } from '@/lib/format/date'
import { QueueRow, QuietRow, VerdictLine } from '@/components/admin/v2'
import { classifyBuildError, DELIBERATE_BUILD_LABEL } from '@/lib/cma/build-error-code'

export const dynamic = 'force-dynamic'

type CmaRow = {
  slug: string
  status: string
  doc_type: string | null
  subject_address: string | null
  subject_city: string | null
  client_name: string | null
  recommended_list: number | null
  created_at: string | null
  built_at: string | null
  finalized_at: string | null
  delivered_at: string | null
  build_error: string | null
  build_summary: unknown
}

function price(n: number | null): string | null {
  return n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`
}

function stoppedLine(failed: number, stalled: number): string {
  const bits: string[] = []
  if (failed > 0) bits.push(`${failed} build${failed === 1 ? '' : 's'} failed`)
  if (stalled > 0) bits.push(`${stalled} did not price`)
  return bits.length ? `${bits.join('. ')}.` : 'Builds are clean.'
}

function daysAgo(iso: string | null, nowMs: number): string | undefined {
  if (!iso) return undefined
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return undefined
  return days === 0 ? 'today' : `${days}d`
}

export default async function ValuationsPage() {
  await requireAdminPage('valuations.view')
  const nowMs = Date.now()

  const [cmas, bpos, bposSeller] = await Promise.all([
    listCmasForAdmin({ limit: 100, offset: 0 }),
    listBposForAdmin({ status: 'all', posture: 'buyer', page: 1, pageSize: 100 }),
    listBposForAdmin({ status: 'all', posture: 'seller', page: 1, pageSize: 100 }),
  ])

  const cmaRows = cmas.rows as CmaRow[]
  const cmaDrafts = cmaRows.filter((r) => r.status === 'draft' && r.built_at && !r.build_error)
  const cmaStopped = cmaRows.filter((r) => !!r.build_error)
  const cmaFailed = cmaStopped.filter((r) => classifyBuildError(r.build_error, r.build_summary) == null)
  const cmaBuilding = cmaRows.filter((r) => r.status === 'draft' && !r.built_at && !r.build_error)
  const cmaDelivered = cmaRows.filter((r) => !!r.delivered_at)

  const allBpos = [...bpos.rows, ...bposSeller.rows]
  const bpoDrafts = allBpos.filter((r) => r.status === 'draft' && !r.archivedAt && !r.buildError)
  const bpoStopped = allBpos.filter((r) => !!r.buildError && !r.archivedAt)
  const bpoFailed = bpoStopped.filter((r) => classifyBuildError(r.buildError, null) == null)

  const needsReview = cmaDrafts.length + bpoDrafts.length
  const failed = cmaFailed.length + bpoFailed.length
  const stalled = cmaStopped.length - cmaFailed.length + (bpoStopped.length - bpoFailed.length)
  const stopped = stoppedLine(failed, stalled)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={needsReview + failed + stalled > 0 ? 'attention' : 'ok'}>
          {needsReview > 0 ? (
            <>
              <b>
                {needsReview} draft{needsReview === 1 ? '' : 's'} waiting for your review.
              </b>{' '}
              {stopped}
            </>
          ) : failed + stalled > 0 ? (
            <>
              <b>{stopped}</b> Nothing else waits on you.
            </>
          ) : (
            <>
              <b>Nothing waits on you.</b> {cmaDelivered.length} delivered so far.
            </>
          )}
        </VerdictLine>
      </div>

      {cmaDrafts.length > 0 && (
        <section aria-label="CMA drafts">
          <h2 className="av2-lane-head">CMA drafts to review</h2>
          <ul className="av2-queue">
            {cmaDrafts.slice(0, 30).map((c) => (
              <QueueRow
                key={c.slug}
                kind="Review"
                kindTone="ok"
                title={c.subject_address ?? c.slug}
                context={[c.client_name ? `for ${c.client_name}` : null, price(c.recommended_list) ? `recommends ${price(c.recommended_list)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
                age={daysAgo(c.built_at, nowMs)}
                action={
                  <Link href={`/admin/cmas/${c.slug}`} className="av2-btn" style={{ textDecoration: 'none' }}>
                    Review
                  </Link>
                }
              />
            ))}
          </ul>
          {cmaDrafts.length > 30 ? (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              …and {cmaDrafts.length - 30} more on the{' '}
              <Link href="/admin/cmas" style={{ color: 'var(--a-accent)' }}>
                CMA board
              </Link>
              .
            </p>
          ) : null}
        </section>
      )}

      {bpoDrafts.length > 0 && (
        <section aria-label="Price opinion drafts">
          <h2 className="av2-lane-head">Price opinion drafts</h2>
          <ul className="av2-queue">
            {bpoDrafts.slice(0, 12).map((b) => (
              <QueueRow
                key={b.id}
                kind="Review"
                kindTone="ok"
                title={b.subjectAddress ?? b.slug}
                context={[
                  b.posture ? `${b.posture} opinion` : null,
                  price(b.opinionValue) ? `opinion ${price(b.opinionValue)}` : null,
                  b.compsCount ? `${b.compsCount} comps` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                age={daysAgo(b.builtAt ?? b.createdAt, nowMs)}
                action={
                  <Link href="/admin/bpo" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                    Open board
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {(cmaStopped.length > 0 || bpoStopped.length > 0) && (
        <section aria-label="Failed builds">
          <h2 className="av2-lane-head">Failed builds</h2>
          <ul className="av2-queue">
            {cmaStopped.slice(0, 8).map((c) => {
              const code = classifyBuildError(c.build_error, c.build_summary)
              return (
                <QueueRow
                  key={c.slug}
                  kind={code ? DELIBERATE_BUILD_LABEL[code] : 'Failed'}
                  kindTone="down"
                  title={c.subject_address ?? c.slug}
                  context={c.build_error ?? 'build failed'}
                  age={daysAgo(c.created_at, nowMs)}
                  action={
                    <Link href={`/admin/cmas/${c.slug}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                      Open
                    </Link>
                  }
                />
              )
            })}
            {bpoStopped.slice(0, 8).map((b) => {
              const code = classifyBuildError(b.buildError, null)
              return (
                <QueueRow
                  key={b.id}
                  kind={code ? DELIBERATE_BUILD_LABEL[code] : 'Failed'}
                  kindTone="down"
                  title={b.subjectAddress ?? b.slug}
                  context={b.buildError ?? 'build failed'}
                  age={daysAgo(b.createdAt, nowMs)}
                  action={
                    <Link href="/admin/bpo" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                      Open board
                    </Link>
                  }
                />
              )
            })}
          </ul>
        </section>
      )}

      {cmaBuilding.length > 0 && (
        <section aria-label="Building">
          <h2 className="av2-lane-head">Building now</h2>
          <ul className="av2-quietlist">
            {cmaBuilding.slice(0, 8).map((c) => (
              <QuietRow key={c.slug} name={c.subject_address ?? c.slug} state="building" figure={daysAgo(c.created_at, nowMs) ?? ''} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Recently delivered">
        <h2 className="av2-lane-head">Recently delivered</h2>
        {cmaDelivered.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>None yet.</p>
        ) : (
          <ul className="av2-quietlist">
            {cmaDelivered.slice(0, 8).map((c) => (
              <QuietRow
                key={c.slug}
                name={c.subject_address ?? c.slug}
                state="delivered"
                figure={formatDate(c.delivered_at)}
              />
            ))}
          </ul>
        )}
      </section>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 24 }}>
        All tools:{' '}
        <Link href="/admin/cmas" style={{ color: 'var(--a-accent)' }}>
          CMA board
        </Link>
        {' · '}
        <Link href="/admin/bpo" style={{ color: 'var(--a-accent)' }}>
          Price opinions
        </Link>
        {' · '}
        <Link href="/admin/prospecting" style={{ color: 'var(--a-accent)' }}>
          Expired audits (Prospecting)
        </Link>
      </p>
    </div>
  )
}
