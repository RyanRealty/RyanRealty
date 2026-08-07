// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/activity — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: requireAdminPage('people.view'), the getCrmAccess
// guard + redirect('/admin/access-denied'), the ?types= allowlist parse and its
// all-types default, scopeBroker → resolveActivityScope and the restricted-
// broker lock, the ?broker= default (the caller's OWN leads), the limit-50
// getGlobalActivityFeed read, the typeChips list, the owner-only brokerOptions,
// every prop handed to GlobalActivityFeed, and MobileCrmHeader mounted
// unchanged (pinned by ci:crm-screen-parity on the People root; its navy
// bg-primary bar is a known §5 violation filed cross-family, not fixed here).
//
// Shape changed, data did not: the page's own <main> is GONE — ConsoleShell
// owns the single landmark and this page rendered a second one; the desktop
// <h1>Activity</h1> is gone (acceptance-bar rule 1 — the nav names the page,
// and Activity is one of the five locked phone tabs); the mobile full-bleed
// offsets now cancel only the shell padding, since the page no longer adds its
// own; and max-w-3xl became an inline maxWidth of the same 768px.
//
// The one claim on this page is conditional ON PURPOSE. Every control inside
// GlobalActivityFeed — the type toggles and the broker select — refetches
// through a server action and holds the result in client state without touching
// the URL, so any server-rendered sentence about what the feed CONTAINS or WHOSE
// leads it shows becomes false the moment a chip is tapped. The single exception
// is a restricted broker: brokerOptions is empty for them, the scope control is
// never rendered, and resolveActivityScope pins them to their own slug — so for
// them, and only them, "your leads only" stays true for the life of the page.
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { resolveActivityScope } from '@/lib/crm/activity-scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  getGlobalActivityFeed,
  ACTIVITY_TYPES,
  ALL_ACTIVITY_TYPE_KEYS,
} from '@/lib/data/crm/getGlobalActivityFeed'
import { VerdictLine } from '@/components/admin/v2'
import GlobalActivityFeed from '@/components/admin/crm/GlobalActivityFeed.client'
import MobileCrmHeader from '@/components/admin/crm/mobile/MobileCrmHeader'

/** Broker slug → web headshot (transparent PNG mirror in public/images/brokers). */
const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export const metadata = { title: 'Activity | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ types?: string; broker?: string }>
}) {
  await requireAdminPage('people.view')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  // Optional deep-link: ?types=email,sms,website. Absent = all types selected.
  const requested = sp.types
    ? sp.types.split(',').map((t) => t.trim()).filter((t) => ALL_ACTIVITY_TYPE_KEYS.includes(t as never))
    : ALL_ACTIVITY_TYPE_KEYS
  const selected = requested.length ? requested : ALL_ACTIVITY_TYPE_KEYS

  // Default to the caller's OWN leads (FUB-style "my activity"); the owner can
  // widen to Everyone or another broker. A restricted broker is locked to theirs.
  const callerScope = scopeBroker(access)
  const isOwner = callerScope === null
  const requestedBroker = sp.broker ?? access.brokerSlug ?? 'all'
  const initialBroker = isOwner ? requestedBroker : (access.brokerSlug ?? 'all')
  const brokerScope = resolveActivityScope(callerScope, initialBroker)

  const { items, nextCursor } = await getGlobalActivityFeed({ types: selected, limit: 50, brokerScope })

  const typeChips = ACTIVITY_TYPES.map((t) => ({ key: t.key, label: t.label }))
  // Broker filter options — only the owner can switch scope.
  const brokerOptions = isOwner
    ? [{ value: 'all', label: 'Everyone' }, ...CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] }))]
    : []

  return (
    <div className="av2-scope" style={{ maxWidth: 768, margin: '0 auto' }}>
      {/* ── MOBILE (< md): §24 navy header — same language as People/Calendar/
             Inbox (Matt punch list #3). Full-bleed cancels the shell padding. */}
      <div className="-mx-4 -mt-5 mb-3 md:hidden sm:-mx-6 sm:-mt-7">
        <MobileCrmHeader
          brokerName={access.brokerSlug ? CRM_BROKER_DISPLAY[access.brokerSlug as keyof typeof CRM_BROKER_DISPLAY] ?? access.brokerSlug : 'Broker'}
          brokerHeadshot={access.brokerSlug ? BROKER_HEADSHOT[access.brokerSlug] ?? null : null}
          center={<span className="truncate text-lg font-medium text-primary-foreground">Activity</span>}
          searchHref="/admin/crm"
        />
      </div>

      {/* Restricted broker only — see the header note. resolveActivityScope
          returns callerScope unconditionally when it is non-null, and the feed
          renders no scope control without brokerOptions, so this cannot go
          stale the way a superuser's scope sentence would. */}
      {!isOwner ? (
        <div style={{ margin: '0 0 12px' }}>
          <VerdictLine tone="ok">
            <b>Your leads only.</b> Newest first.
          </VerdictLine>
        </div>
      ) : null}

      <GlobalActivityFeed
        initialItems={items}
        initialCursor={nextCursor}
        allTypes={typeChips}
        initialSelected={selected}
        brokerOptions={brokerOptions}
        initialBroker={initialBroker}
      />
    </div>
  )
}
