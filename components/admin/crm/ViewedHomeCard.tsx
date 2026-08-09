'use client'

/**
 * FUB-clone property card for the contact-360 Homes tab. Renders one home the
 * lead is shopping as a vertical card — photo with an activity badge overlay,
 * price + live MLS status, beds/baths, linked address, MLS#, and view count —
 * matching the Follow Up Boss iOS Homes tab (screen ui1_5835).
 *
 * Buyer-side BPO: a compact "Draft BPO" action starts a broker price opinion
 * against THIS listing (the home the lead is shopping), pre-linked to the
 * contact, via startBpoForContactAction(personId, listingKey). Review-first —
 * the action only lands a draft at /admin/bpo/<slug>; nothing is sent. The
 * person id comes from the /admin/crm/[id] route param (or an explicit prop),
 * so the card needs no parent changes.
 *
 * Honesty note (§0): FUB's badge reads "Property Inquiry" off a lead-form
 * submission. We track on-site views + saves, so the badge reflects what we
 * actually know ("Saved" / "Viewed") rather than asserting an inquiry. Price and
 * status come live from listing_tile_mv via getViewedListingsForLead.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Badge -> StateWord (the overlay's position moves to a wrapper because
 * StateWord takes no className), Button -> the v2 Button, and every shadcn
 * semantic class -> its var(--a-*) token. The shell stays a bordered div rather
 * than av2-pane: the photo is full-bleed to the card edge and a pane's own
 * padding would inset it.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowUpRight, Eye, FileText, Loader2 } from 'lucide-react'
import { Button, StateWord } from '@/components/admin/v2'
import { ListingStatusPill } from '@/components/console/StatusPill'
import { startBpoForContactAction } from '@/app/actions/contact-bpo'
import { resolveViewedHomePersonId } from '@/components/admin/crm/viewed-home-bpo'
import type { ViewedListing } from '@/lib/data/crm/getViewedListings'

function usd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return 'Price n/a'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function bath(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null
  return Number.isInteger(n) ? `${n} ba` : `${n.toFixed(1)} ba`
}

export default function ViewedHomeCard({ home, personId }: { home: ViewedListing; personId?: number }) {
  const params = useParams<{ id?: string | string[] }>()
  const resolvedPersonId = resolveViewedHomePersonId(personId, params?.id)
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<{ slug: string; existing: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const beds = home.beds !== null && Number.isFinite(home.beds) ? `${home.beds} bd` : null
  const baths = bath(home.baths)
  const specs = [beds, baths].filter(Boolean).join(' · ')
  const badge = home.saved ? 'Saved' : 'Viewed'

  const draftBpo = () => {
    if (!resolvedPersonId || !home.listingKey || isPending || draft) return
    setError(null)
    startTransition(async () => {
      const r = await startBpoForContactAction(resolvedPersonId, home.listingKey)
      if (r.ok) setDraft({ slug: r.slug, existing: r.existing === true })
      else setError(r.error)
    })
  }

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
    >
      <div className="relative">
        {home.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={home.photoUrl} alt={home.address} className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="flex aspect-video w-full items-center justify-center"
            style={{ background: 'var(--a-inset)', fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}
          >
            No photo
          </div>
        )}
        {/* StateWord takes no className, so the overlay position lives on a wrapper. */}
        <span className="absolute left-2 top-2">
          <StateWord state="accent">{badge}</StateWord>
        </span>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="tabular-nums" style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
            {usd(home.listPrice)}
          </span>
          <ListingStatusPill status={home.status} />
        </div>
        {specs ? <div style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>{specs}</div> : null}
        {home.listingKey ? (
          <Link
            href={`/listing/${home.listingKey}`}
            className="block truncate font-medium hover:underline"
            style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
          >
            {home.address}
            {home.city ? `, ${home.city}` : ''}
          </Link>
        ) : (
          <div className="truncate font-medium" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
            {home.address}
          </div>
        )}
        <div className="font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          MLS #{home.listingKey}
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div
            className="flex items-center gap-1.5"
            style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {home.views} view{home.views === 1 ? '' : 's'}
          </div>
          {resolvedPersonId && home.listingKey ? (
            draft ? (
              <Link
                href={`/admin/bpo/${draft.slug}`}
                className="inline-flex items-center gap-1 font-medium hover:underline"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-accent)' }}
              >
                {draft.existing ? 'Open BPO' : 'Open BPO draft'}
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : (
              <Button
                type="button"
                variant="quiet"
                onClick={draftBpo}
                disabled={isPending}
                aria-label={`Draft a broker price opinion for ${home.address}`}
                title="Build a draft price opinion for this home, linked to this contact. Review-first, nothing is sent."
              >
                {/* shadcn's size="xs" auto-sized bare icons to 12px; av2-btn has no
                    svg rule, so the size is stated rather than inherited. */}
                {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <FileText className="size-3" aria-hidden />}
                {isPending ? 'Drafting…' : 'Draft BPO'}
              </Button>
            )
          ) : null}
        </div>
        {error ? <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p> : null}
      </div>
    </div>
  )
}
