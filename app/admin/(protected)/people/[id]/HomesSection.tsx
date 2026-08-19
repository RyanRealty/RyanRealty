/**
 * HomesSection (P11B B2) — the person's homes story: viewed listings (event
 * trail) unioned with real consumer saves (likes + saved_listings) via
 * buildHomesPanelUnion — the SAME machinery the legacy homes panel used.
 * Every address is a door to the listing admin page; the portal door opens
 * the read-only client-portal mirror. Async — streams under Suspense.
 */
import Link from 'next/link'
import { SectionHead, StateWord } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import { getViewedListingsForLead } from '@/lib/data'
import { buildHomesPanelUnion, getContactSavedHomes } from '@/lib/data/crm/getContactSavedHomes'

function money(n: number | null): string {
  return n != null ? `$${Math.round(n).toLocaleString('en-US')}` : ''
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatDate(d, { month: 'short', day: 'numeric' })
}

export async function HomesSection({
  personId,
  fubLegacyId,
  personEmails,
}: {
  personId: number
  fubLegacyId: number | null
  personEmails: string[]
}) {
  const [viewed, saved] = await Promise.all([
    getViewedListingsForLead({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
    getContactSavedHomes({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
  ])
  const homes = buildHomesPanelUnion(viewed, saved)

  return (
    <section aria-label="Homes">
      <SectionHead>Homes</SectionHead>
      <ul className="av2-quietlist">
        {homes.map((h) => (
          <li key={h.listingKey} className="av2-quiet" style={{ alignItems: 'center' }}>
            <Link
              href={`/admin/listings/${encodeURIComponent(h.listingKey)}`}
              className="av2-quiet__name"
              style={{ minWidth: 200, color: 'var(--a-accent)', textDecoration: 'none' }}
            >
              {[h.address, h.city].filter(Boolean).join(', ')}
            </Link>
            <span>
              {[
                money(h.listPrice),
                h.beds != null ? `${h.beds} bd` : null,
                h.baths != null ? `${h.baths} ba` : null,
                h.status,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {h.saved ? <StateWord state="accent">Saved</StateWord> : null}
            <span className="av2-quiet__fig">
              {h.views > 0 ? `${h.views} view${h.views === 1 ? '' : 's'} · ` : ''}
              {dayLabel(h.lastViewedAt)}
            </span>
          </li>
        ))}
        {homes.length === 0 ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No viewed or saved homes yet.</span>
          </li>
        ) : null}
      </ul>
      <Link
        href={`/admin/people/${personId}/portal`}
        className="av2-btn av2-btn--quiet"
        style={{ textDecoration: 'none' }}
      >
        Their portal view (read only)
      </Link>
    </section>
  )
}
