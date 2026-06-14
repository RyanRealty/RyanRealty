import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { getDashboardLikesData } from '@/app/actions/dashboard-likes'
import { getRecentListingViews } from '@/app/actions/dashboard-history'
import { getListingsByKeys } from '@/app/actions/listings'
import ListingTile from '@/components/ListingTile'
import ExportMyDataButton from '@/components/ExportMyDataButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your home search at Ryan Realty — saved homes, searches, and preferences in one place.',
}

export const dynamic = 'force-dynamic'

function keyOf(listing: { ListNumber?: unknown; ListingKey?: unknown }): string {
  return (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
}

function humanize(slug: string): string {
  const base = slug.includes(':') ? slug.split(':').pop()! : slug
  return base.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Quiet grouped-list section header with an optional trailing action. */
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {action.label} →
        </Link>
      ) : null}
    </div>
  )
}

export default async function AccountPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const [profile, likesData, savedKeys, savedSearches, savedCitySlugs, savedCommunityKeys, recentViews, prefs] =
    await Promise.all([
      getProfile(),
      getDashboardLikesData(),
      getSavedListingKeys(),
      getSavedSearches(),
      getSavedCitySlugs(),
      getSavedCommunityKeys(),
      getRecentListingViews(8),
      getBuyingPreferences(),
    ])

  // Unify the two parallel "homes I care about" systems (saved_listings + likes)
  // into one deduped list so the visitor sees ONE set of homes, not two.
  const savedListings = savedKeys.length ? await getListingsByKeys(savedKeys) : []
  const homeMap = new Map<string, (typeof savedListings)[number]>()
  for (const l of [...likesData.listings, ...savedListings]) {
    const k = keyOf(l)
    if (k && !homeMap.has(k)) homeMap.set(k, l)
  }
  const homes = [...homeMap.values()]

  const viewedListings = recentViews.length
    ? await getListingsByKeys(recentViews.map((v) => v.entity_id).filter(Boolean))
    : []
  const viewedMap = new Map(viewedListings.map((l) => [keyOf(l), l]))

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }
  const monthlyFor = (price: number): string | undefined => {
    if (!(price > 0)) return undefined
    const m = estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears)
    return m > 0 ? formatMonthlyPayment(m) : undefined
  }

  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const firstName = (profile?.displayName?.trim() || authName || session.user.email || 'there').split(/\s+/)[0]
  const placesCount = savedCitySlugs.length + savedCommunityKeys.length
  const userEmail = session.user.email ?? null

  const stats: { label: string; value: number; href: string }[] = [
    { label: 'Saved homes', value: homes.length, href: '/account/saved-homes' },
    { label: 'Saved searches', value: savedSearches.length, href: '/account/saved-searches' },
    { label: 'Places followed', value: placesCount, href: '/account/saved-cities' },
    { label: 'Recently viewed', value: recentViews.length, href: '/account/history' },
  ]

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Welcome back, {firstName}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything from your home search, in one place.</p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Browse homes</Link>
        </Button>
      </header>

      {/* ── Glance strip ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="px-3 py-3 transition-colors hover:bg-muted/40">
              <span className="block text-2xl font-bold leading-none tabular-nums text-foreground">{s.value}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{s.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Homes you're tracking (saved + liked, unified) ── */}
      <section>
        <SectionHeader
          title="Homes you're tracking"
          sub="Everything you've saved or liked."
          action={homes.length > 6 ? { href: '/account/saved-homes', label: `See all ${homes.length}` } : undefined}
        />
        {homes.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved homes yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Tap the heart on any listing to keep it here and get price-drop and status alerts.</p>
            <Button asChild size="sm"><Link href={listingsBrowsePath()}>Browse homes</Link></Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homes.slice(0, 6).map((listing) => {
              const key = keyOf(listing)
              return (
                <ListingTile
                  key={key}
                  listing={listing}
                  listingKey={key}
                  saved
                  monthlyPayment={monthlyFor(Number(listing.ListPrice ?? 0))}
                  signedIn
                  userEmail={userEmail}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* ── Saved searches ── */}
      <section>
        <SectionHeader
          title="Saved searches"
          sub="We watch these for new and updated listings."
          action={{ href: '/account/saved-searches', label: 'Manage' }}
        />
        {savedSearches.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 px-4 py-6">
            <p className="text-sm text-muted-foreground">Save any search to get notified when matching homes hit the market.</p>
            <Button asChild size="sm" variant="outline"><Link href={listingsBrowsePath()}>Start a search</Link></Button>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {savedSearches.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                href={`/account/saved-searches`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{s.name || 'Untitled search'}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {typeof s.result_count === 'number' ? `${s.result_count} matches` : 'Tap to view results'}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-primary">View</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* ── Recently viewed ── */}
      {recentViews.length > 0 ? (
        <section>
          <SectionHeader title="Recently viewed" action={{ href: '/account/history', label: 'Full history' }} />
          <Card className="divide-y divide-border overflow-hidden p-0">
            {recentViews.slice(0, 5).map((view) => {
              const listing = viewedMap.get(view.entity_id)
              if (!listing) return null
              const key = keyOf(listing)
              const title =
                [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim() || listing.City || key
              return (
                <Link
                  key={view.id}
                  href={listingDetailPath(
                    key,
                    {
                      streetNumber: listing.StreetNumber,
                      streetName: listing.StreetName,
                      city: listing.City,
                      state: listing.State,
                      postalCode: listing.PostalCode,
                    },
                    { city: listing.City, subdivision: listing.SubdivisionName },
                    { mlsNumber: listing.ListNumber ?? null },
                  )}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {new Date(view.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              )
            })}
          </Card>
        </section>
      ) : null}

      {/* ── Places you follow ── */}
      {placesCount > 0 ? (
        <section>
          <SectionHeader title="Places you follow" action={{ href: '/account/saved-cities', label: 'Manage' }} />
          <div className="flex flex-wrap gap-2">
            {savedCitySlugs.slice(0, 8).map((slug) => (
              <Link
                key={`c-${slug}`}
                href={`/${slug}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                {humanize(slug)}
              </Link>
            ))}
            {savedCommunityKeys.slice(0, 8).map((entityKey) => (
              <Link
                key={`k-${entityKey}`}
                href="/account/saved-communities"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                {humanize(entityKey)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Your agent ── */}
      <section>
        <SectionHeader title="Your agent" />
        <Card className="flex items-center gap-4 p-4">
          <Image
            src="/images/brokers/ryan-matt.png"
            alt="Matt Ryan, principal broker"
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Matt Ryan</p>
            <p className="text-xs text-muted-foreground">Principal broker · Ryan Realty</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button asChild size="sm" variant="outline"><a href="tel:5412136706">Call</a></Button>
            <Button asChild size="sm"><a href="mailto:matt@ryan-realty.com">Email</a></Button>
          </div>
        </Card>
      </section>

      {/* ── Settings & preferences ── */}
      <section>
        <SectionHeader title="Settings & preferences" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { href: '/account/buying-preferences', title: 'Buying preferences', desc: prefs ? `${prefs.downPaymentPercent}% down · ${prefs.interestRate}% · ${prefs.loanTermYears} yr` : 'Set down payment, rate, and term for payment estimates' },
            { href: '/account/profile', title: 'Profile', desc: 'Name, phone, and email' },
            { href: '/account/notifications', title: 'Notifications', desc: 'Email alerts and how often we reach out' },
            { href: '/account/collections', title: 'Collections', desc: 'Group saved homes into named lists' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="flex h-full flex-col p-4 transition-colors hover:bg-muted/40">
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                <span className="mt-1 text-xs text-muted-foreground">{item.desc}</span>
              </Card>
            </Link>
          ))}
        </div>
        <Card className="mt-3 flex flex-col items-start gap-2 p-4">
          <span className="text-sm font-semibold text-foreground">Privacy &amp; data</span>
          <span className="text-xs text-muted-foreground">
            Download a copy of your data — saved homes, searches, profile, and activity. For deletion requests, contact us.
          </span>
          <ExportMyDataButton className="mt-1" />
        </Card>
      </section>
    </div>
  )
}
