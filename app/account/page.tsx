import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { CONTACT } from '@/lib/brand/contact'
import { getSession } from '@/app/actions/auth'
import { getAdminContext } from '@/lib/auth/guards'
import { getProfile } from '@/app/actions/profile'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { getDashboardLikesData } from '@/app/actions/dashboard-likes'
import { getRecentListingViews } from '@/app/actions/dashboard-history'
import { getListingsByKeys } from '@/app/actions/listings'
import { listAreasForUser, getMyCmas } from '@/lib/data'
import { getUserActivityEvents, getUserActivitySummary } from '@/lib/data/activity/getUserEvents'
import { getPortalHomeLists, getSavedSearchInsights, totalNewSince } from '@/app/account/portal-data'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'
import ListingTile from '@/components/ListingTile'
import ExportMyDataButton from '@/components/ExportMyDataButton'
import PortalTabs from '@/components/account/portal/PortalTabs'
import { resolvePortalTab, type PortalTabId } from '@/components/account/portal/tabs'
import ActivityFeed from '@/components/account/portal/ActivityFeed'
import MarkAllSeenButton from '@/components/account/portal/MarkAllSeenButton'
import AreaControls, { type AreaListRow } from '@/components/account/areas/AreaControls'
import SavedSearchControls from '@/app/account/saved-searches/SavedSearchControls'
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
  description: 'Your home search at Ryan Realty. Alerts, saved homes, areas, and activity in one place.',
}

// Rendered per-request automatically: getSession() reads the auth cookie, which
// opts this route out of static rendering (same as the sibling /account pages).

type PageProps = { searchParams: Promise<{ tab?: string | string[] }> }

function keyOf(listing: { ListNumber?: unknown; ListingKey?: unknown }): string {
  return (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
}

function humanize(slug: string): string {
  const base = slug.includes(':') ? slug.split(':').pop()! : slug
  return base.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function addressOf(listing: {
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
}): string {
  return [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim() || listing.City || ''
}

/** Quiet grouped-list section header with an optional trailing action. */
function SectionHeader({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: { href: string; label: string }
}) {
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

/**
 * The /account portal (Phase 4.1, docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md).
 *
 * ONE surface carries the whole consumer side of the search product: every
 * alert with its event toggles and cadence, "new since last visit" per saved
 * search, the named-area manager, the homes the visitor tracks, and their own
 * recorded activity. The panels mount the SAME managers the standalone
 * /account/saved-searches and /account/areas routes mount, so an alert email
 * deep link and the portal never drift apart.
 *
 * §0: every number on this page is the result of a query run in this render.
 * Match counts and "new since" come from app/account/portal-data.ts, activity
 * counts from app/actions/account-activity.ts, and everything else is the
 * length of a real fetched list. Nothing is a placeholder.
 */
export default async function AccountPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const userId = session.user.id

  const { tab: tabParam } = await searchParams
  const initialTab: PortalTabId = resolvePortalTab(tabParam)

  const [
    profile,
    likesData,
    savedKeys,
    savedSearches,
    savedCitySlugs,
    savedCommunityKeys,
    homeLists,
    recentViews,
    prefs,
    areas,
    admin,
    activityRows,
    activitySummary,
    myCmas,
  ] = await Promise.all([
    getProfile(),
    getDashboardLikesData(),
    getSavedListingKeys(),
    getSavedSearches(),
    getSavedCitySlugs(),
    getSavedCommunityKeys(),
    getPortalHomeLists(),
    getRecentListingViews(8),
    getBuyingPreferences(),
    listAreasForUser(userId),
    getAdminContext(),
    getUserActivityEvents(userId, 40),
    getUserActivitySummary(userId, 30),
    getMyCmas(session.user.email),
  ])
  const { hiddenKeys, collections } = homeLists

  // Live per-search figures: exact match count + "new since last visit".
  const insights = await getSavedSearchInsights(savedSearches)
  const newAcrossSearches = totalNewSince(insights)

  // Unify the two parallel "homes I care about" systems (saved_listings + likes)
  // into one deduped list so the visitor sees ONE set of homes, not two.
  const savedListings = savedKeys.length ? await getListingsByKeys(savedKeys) : []
  const homeMap = new Map<string, (typeof savedListings)[number]>()
  for (const l of [...likesData.listings, ...savedListings]) {
    const k = keyOf(l)
    if (k && !homeMap.has(k)) homeMap.set(k, l)
  }
  const homes = [...homeMap.values()]

  // One listings read covers both the recently-viewed strip and the activity
  // feed's listing labels.
  const activityListingKeys = activityRows.map((row) => row.listingKey ?? '').filter(Boolean)
  const lookupKeys = [
    ...new Set([...recentViews.map((v) => v.entity_id).filter(Boolean), ...activityListingKeys]),
  ]
  const lookedUp = lookupKeys.length ? await getListingsByKeys(lookupKeys) : []
  const listingByKey = new Map<string, (typeof lookedUp)[number]>()
  for (const l of lookedUp) {
    const lk = (l.ListingKey ?? '').toString().trim()
    const ln = (l.ListNumber ?? '').toString().trim()
    if (lk) listingByKey.set(lk, l)
    if (ln) listingByKey.set(ln, l)
  }

  const listingLabels: Record<string, string> = {}
  const listingHrefs: Record<string, string> = {}
  for (const key of lookupKeys) {
    const listing = listingByKey.get(key)
    if (!listing) continue
    const label = addressOf(listing)
    if (label) listingLabels[key] = label
    listingHrefs[key] = listingDetailPath(
      keyOf(listing),
      {
        streetNumber: listing.StreetNumber,
        streetName: listing.StreetName,
        city: listing.City,
        state: listing.State,
        postalCode: listing.PostalCode,
      },
      { city: listing.City, subdivision: listing.SubdivisionName },
      { mlsNumber: listing.ListNumber ?? null },
    )
  }

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }
  const monthlyFor = (price: number): string | undefined => {
    if (!(price > 0)) return undefined
    const m = estimatedMonthlyPayment(
      price,
      displayPrefs.downPaymentPercent,
      displayPrefs.interestRate,
      displayPrefs.loanTermYears,
    )
    return m > 0 ? formatMonthlyPayment(m) : undefined
  }

  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const firstName = (profile?.displayName?.trim() || authName || session.user.email || 'there').split(/\s+/)[0]
  const placesCount = savedCitySlugs.length + savedCommunityKeys.length
  const userEmail = session.user.email ?? null
  const isBroker = admin?.role === 'superuser' || admin?.role === 'broker'
  const activeAlerts = savedSearches.filter((s) => !s.is_paused).length
  const newCountLabel = newAcrossSearches.count
    ? `${newAcrossSearches.count}${newAcrossSearches.saturated ? '+' : ''}`
    : null

  const areaRows: AreaListRow[] = areas.map((area) => ({
    id: area.id,
    name: area.name,
    slug: area.slug,
    shapes: area.shapes,
    is_public: area.is_public,
    updated_at: area.updated_at,
  }))

  const stats: { label: string; value: string; href: string }[] = [
    { label: 'Saved homes', value: String(homes.length), href: '/account?tab=homes' },
    { label: 'Alerts on', value: String(activeAlerts), href: '/account?tab=alerts' },
    { label: 'New since your last visit', value: newCountLabel ?? '0', href: '/account?tab=alerts' },
    { label: 'Named areas', value: String(areas.length), href: '/account?tab=areas' },
    { label: 'Places you follow', value: String(placesCount), href: '/account/saved-cities' },
  ]

  // ── Overview ───────────────────────────────────────────────────────────────
  const overview = (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="h-full px-3 py-3 transition-colors hover:bg-muted/40">
              <span className="block text-2xl font-bold leading-none tabular-nums text-foreground">{s.value}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <SectionHeader
          title="Homes you're tracking"
          sub="Everything you've saved or liked."
          action={homes.length > 6 ? { href: '/account?tab=homes', label: `See all ${homes.length}` } : undefined}
        />
        {homes.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved homes yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tap the heart on any listing to keep it here and get price-drop and status alerts.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Browse homes</Link>
            </Button>
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

      {recentViews.length > 0 ? (
        <section>
          <SectionHeader title="Recently viewed" action={{ href: '/account/history', label: 'Full history' }} />
          <Card className="divide-y divide-border overflow-hidden p-0">
            {recentViews.slice(0, 5).map((view) => {
              const listing = listingByKey.get(view.entity_id)
              if (!listing) return null
              const key = keyOf(listing)
              return (
                <Link
                  key={view.id}
                  href={
                    listingHrefs[view.entity_id] ??
                    listingDetailPath(key, {
                      streetNumber: listing.StreetNumber,
                      streetName: listing.StreetName,
                      city: listing.City,
                      state: listing.State,
                      postalCode: listing.PostalCode,
                    })
                  }
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {addressOf(listing) || key}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {new Date(view.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              )
            })}
          </Card>
        </section>
      ) : null}

      {placesCount > 0 ? (
        <section>
          <SectionHeader title="Places you follow" action={{ href: '/account/saved-cities', label: 'Manage' }} />
          <div className="flex flex-wrap gap-2">
            {savedCitySlugs.slice(0, 8).map((slug) => (
              <Link
                key={`c-${slug}`}
                href={`/cities/${slug}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                {humanize(slug)}
              </Link>
            ))}
            {savedCommunityKeys.slice(0, 8).map((entityKey) => (
              <Link
                key={`k-${entityKey}`}
                href={`/homes-for-sale/${entityKey.replace(':', '/')}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                {humanize(entityKey)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Your agent" />
        <Card className="flex items-center gap-4 p-4">
          <Image
            src="/images/brokers/ryan-matt.png"
            alt="Matt Ryan, principal broker"
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full border border-border object-cover object-top"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Matt Ryan</p>
            <p className="text-xs text-muted-foreground">Principal broker · Ryan Realty</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
            </Button>
            <Button asChild size="sm">
              <a href="mailto:matt@ryan-realty.com">Email</a>
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="Settings and preferences" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              href: '/account/buying-preferences',
              title: 'Buying preferences',
              desc: prefs
                ? `${prefs.downPaymentPercent}% down · ${prefs.interestRate}% · ${prefs.loanTermYears} yr`
                : 'Set down payment, rate, and term for payment estimates',
            },
            { href: '/account/profile', title: 'Profile', desc: 'Name, phone, and email' },
            { href: '/account/notifications', title: 'Notifications', desc: 'Email alerts and how often we reach out' },
            { href: '/account/saved-communities', title: 'Saved communities', desc: 'Communities you follow' },
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
          <span className="text-sm font-semibold text-foreground">Privacy and data</span>
          <span className="text-xs text-muted-foreground">
            Download a copy of your data. Saved homes, searches, profile, and activity. For deletion requests, contact
            us.
          </span>
          <ExportMyDataButton className="mt-1" />
        </Card>
      </section>

      {myCmas.length > 0 ? (
        <section>
          <SectionHeader title="Home value reports" sub="Reports we prepared for you." />
          <Card className="divide-y divide-border overflow-hidden p-0">
            {myCmas.map((cma) => (
              <div key={cma.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{cma.subjectAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    Delivered{' '}
                    {new Date(cma.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <Link href={`/cma/${cma.slug}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  View report
                </Link>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  )

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts = (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Alerts and saved searches</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pause or resume each alert, pick what to watch and how often we email, share it with your household,
            rename, or remove it.
          </p>
        </div>
        {newCountLabel ? <MarkAllSeenButton /> : null}
      </div>
      {savedSearches.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No saved searches yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Save any search to get an email when a matching home hits the market.
          </p>
          <Button asChild size="sm">
            <Link href={listingsBrowsePath()}>Start a search</Link>
          </Button>
        </Card>
      ) : (
        <SavedSearchControls searches={savedSearches} insights={insights} />
      )}
    </section>
  )

  // ── Areas ──────────────────────────────────────────────────────────────────
  const areasPanel = (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">My areas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Named map areas you drew on the search map, ready to reuse in any search or alert.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Draw a new area</Link>
        </Button>
      </div>
      {areaRows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No saved areas yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Draw shapes on the search map and save them as a named area, like Bend west side. Then reuse it across
            searches and alerts.
          </p>
          <Button asChild size="sm">
            <Link href={listingsBrowsePath()}>Open the search map</Link>
          </Button>
        </Card>
      ) : (
        <AreaControls areas={areaRows} isBroker={isBroker} />
      )}
    </section>
  )

  // ── Homes ──────────────────────────────────────────────────────────────────
  const homesPanel = (
    <>
      <section>
        <SectionHeader title="Saved homes" sub="Everything you've saved or liked." />
        {homes.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved homes yet.</p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Browse homes</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homes.map((listing) => {
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

      <section>
        <SectionHeader
          title="Collections"
          sub="Group your saved homes into named lists."
          action={{ href: '/account/collections', label: 'Manage' }}
        />
        {collections.length === 0 ? (
          <Card className="px-4 py-6">
            <p className="text-sm text-muted-foreground">
              No collections yet. Build one for each search, neighborhood, or shortlist.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/account/collections/${collection.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{collection.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {collection.listing_keys.length} homes
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionHeader
          title="Hidden homes"
          sub="Kept out of your results and your alert emails."
          action={{ href: '/account/hidden', label: 'Manage' }}
        />
        <Card className="px-4 py-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">{hiddenKeys.length}</span> hidden
          </p>
        </Card>
      </section>
    </>
  )

  // ── Activity ───────────────────────────────────────────────────────────────
  const activity = (
    <section>
      <SectionHeader title="Your activity" action={{ href: '/account/history', label: 'Viewing history' }} />
      <ActivityFeed
        rows={activityRows}
        summary={activitySummary}
        listingLabels={listingLabels}
        listingHrefs={listingHrefs}
      />
    </section>
  )

  return (
    <AccountFrame>
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything from your home search, in one place.</p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Browse homes</Link>
        </Button>
      </header>

      <PortalTabs
        initialTab={initialTab}
        counts={newCountLabel ? { alerts: newCountLabel } : undefined}
        panels={{
          overview,
          alerts,
          areas: areasPanel,
          homes: homesPanel,
          activity,
        }}
      />
    </div>
    </AccountFrame>
  )
}
