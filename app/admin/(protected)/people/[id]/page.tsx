// @no-parity — internal admin surface, no public mockup contract
// Person entity page (P9 roll:people, IA lock 2026-08-05; locked pattern 5:
// identity header + ONE primary action + stacked context). Carries the v2 CMA
// kickoff surface (Matt's litmus scoping call 2026-08-05): ?intent=cma renders
// the kickoff card open — the same idempotent core the litmus proved. The full
// legacy workspace stays one tap away at /admin/crm/[id]. This route also
// resolves LEGACY ids (pre-2026-07-09 bookmarks): unknown person id falls back
// to the legacy-id map before 404ing.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getContactActivityFeed } from '@/lib/data/crm/getContactActivityFeed'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { getContactCmas } from '@/lib/data/crm/getContactCmas'
import { getContactBpos } from '@/lib/data/crm/getContactBpos'
import { getContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import { extractAddressCandidate } from '@/lib/crm/seller-intent'
import { Button, StateWord, TextField } from '@/components/admin/v2'
import { kickoffCmaFromPerson } from '../actions'

export const dynamic = 'force-dynamic'

function tsLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ intent?: string; kicked?: string; err?: string }>
}) {
  await requireAdminPage('people.view')
  const idNum = Number((await params).id)
  if (!Number.isFinite(idNum) || idNum <= 0) notFound()
  const sp = await searchParams

  const card = await getInboxContactCard(idNum)
  if (!card) {
    // Legacy-id fallback (absorbed /admin/people/[legacyId] shim, renamed 2026-07-09).
    const mapped = await getPersonIdByLegacyId(idNum)
    if (mapped) redirect(`/admin/people/${mapped}`)
    notFound()
  }

  const [feed, cmas, bpos, prospectStory] = await Promise.all([
    getContactActivityFeed(idNum, 30),
    getContactCmas({ crmPersonId: idNum, emails: card.email ? [card.email] : [] }),
    getContactBpos({ crmPersonId: idNum }),
    getContactProspectStory({ personId: idNum }),
  ])
  const showKickoff = sp.intent === 'cma' || sp.kicked === '1'
  const kicked = sp.kicked === '1'
  // Litmus parity with the legacy sheet (P8 bar: alert → 2 taps, no typing):
  // suggest the address parsed from the latest inbound text. Editable — the
  // broker confirms it before building.
  const latestInbound = feed.find((t) => t.kind === 'sms_in')?.snippet ?? null
  const suggestedAddress = extractAddressCandidate(latestInbound)

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'var(--a-text-xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>
          {card.name ?? 'Unknown contact'}
        </h1>
        <StateWord state="accent">{card.stage}</StateWord>
        {card.assignedBroker ? (
          <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>assigned {card.assignedBroker}</span>
        ) : null}
      </div>
      {/* Contact points are doors (acceptance bar #3): tap to call/email. */}
      <div style={{ margin: '4px 0 4px', fontSize: 'var(--a-text-sm)', fontFamily: 'var(--a-font-mono)' }}>
        {card.phone ? (
          <a href={`tel:${card.phone}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            {card.phone}
          </a>
        ) : null}
        {card.phone && card.email ? <span style={{ color: 'var(--a-text-2)' }}> · </span> : null}
        {card.email ? (
          <a href={`mailto:${card.email}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            {card.email}
          </a>
        ) : null}
        {!card.phone && !card.email ? <span style={{ color: 'var(--a-text-2)' }}>No contact points</span> : null}
      </div>
      <div style={{ margin: '0 0 14px', color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
        {[
          card.source ? `source ${card.source}` : null,
          card.price != null ? `budget $${Math.round(card.price).toLocaleString('en-US')}` : null,
          card.timeframe ?? null,
          card.tags.length > 0 ? card.tags.slice(0, 4).join(', ') : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href={`/admin/messages?c=${card.personId}`}>
          <Button>Message</Button>
        </Link>
        {card.phone ? (
          <a href={`tel:${card.phone}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Call
          </a>
        ) : null}
        {card.email ? (
          <a href={`mailto:${card.email}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Email
          </a>
        ) : null}
        {!showKickoff ? (
          <Link href={`/admin/people/${card.personId}?intent=cma`}>
            <Button variant="quiet">Build a CMA</Button>
          </Link>
        ) : null}
        <Link href={`/admin/crm/${card.personId}`}>
          <Button variant="quiet">All tools</Button>
        </Link>
      </div>

      {showKickoff ? (
        <section
          aria-label="Build a CMA"
          style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-lg)', padding: 16, marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, marginBottom: 4 }}>Build a CMA</h2>
          {kicked ? (
            <p style={{ color: 'var(--a-ok)', fontWeight: 500 }}>
              CMA build kicked off — you&apos;ll get a text when the draft is ready to review. Nothing is sent to the
              lead until you approve it.
            </p>
          ) : (
            <form action={kickoffCmaFromPerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="hidden" name="personId" value={card.personId} />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <TextField
                label="Property address"
                name="address"
                required
                defaultValue={suggestedAddress ?? undefined}
                placeholder="123 NW Bond St, Bend"
                hint={
                  suggestedAddress
                    ? 'Parsed from their text — confirm it before building.'
                    : 'Include the city so comps resolve. Confirm it before building.'
                }
                error={sp.err ? decodeURIComponent(sp.err) : undefined}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" touch>
                  Build CMA — text me when ready
                </Button>
                <Link href={`/admin/people/${card.personId}`}>
                  <Button variant="quiet" touch>
                    Not now
                  </Button>
                </Link>
              </div>
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
                The draft lands in the CMA queue for your review. Nothing is sent to the lead until you approve it.
              </p>
            </form>
          )}
        </section>
      ) : null}

      {prospectStory.length > 0 && (
        <section aria-label="Prospect story">
          <h2 className="av2-lane-head">Prospecting</h2>
          <ul className="av2-quietlist">
            {prospectStory.map((s) => (
              <li key={s.prospectId} className="av2-quiet">
                <Link href={s.detailHref} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {[s.streetAddress, s.city].filter(Boolean).join(', ') || s.prospectId}
                </Link>
                <span style={{ color: 'var(--a-text-2)' }}>
                  {s.kind === 'expired' ? s.status : 'FSBO'}
                  {s.lastListPrice != null ? ` · was $${Math.round(s.lastListPrice).toLocaleString('en-US')}` : ''}
                  {s.priorAgentName ? ` · prior agent ${s.priorAgentName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(cmas.length > 0 || bpos.length > 0) && (
        <section aria-label="Valuations">
          <h2 className="av2-lane-head">Valuations</h2>
          <ul className="av2-quietlist">
            {cmas.map((c) => (
              <li key={c.slug} className="av2-quiet">
                <Link href={c.reviewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {c.subjectAddress}
                </Link>
                <span className="av2-quiet__ok" style={{ color: c.buildState === 'failed' ? 'var(--a-danger)' : undefined }}>
                  {c.status}
                </span>
                <span className="av2-quiet__fig">{c.valueLine ?? ''}</span>
              </li>
            ))}
            {bpos.map((b) => (
              <li key={b.slug} className="av2-quiet">
                <Link href={b.previewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {b.subjectAddress}
                </Link>
                <span className="av2-quiet__ok">{b.status} BPO</span>
                <span className="av2-quiet__fig">{b.opinionLine ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="av2-lane-head">Recent activity</h2>
      <ul className="av2-quiet-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {feed.map((m) => (
          <li key={m.id} className="av2-quiet">
            <span className="av2-quiet__name" style={{ minWidth: 90 }}>
              {tsLabel(m.ts)}
            </span>
            <span style={{ color: 'var(--a-text)' }}>{m.label}</span>
            {m.snippet ? <span className="av2-quiet__fig" style={{ fontVariantNumeric: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{m.snippet}</span> : null}
          </li>
        ))}
        {feed.length === 0 ? <li className="av2-sysnote" style={{ padding: 12 }}>No activity yet.</li> : null}
      </ul>
    </main>
  )
}
