// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { resolveActivityScope } from '@/lib/crm/activity-scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  getGlobalActivityFeed,
  ACTIVITY_TYPES,
  ALL_ACTIVITY_TYPE_KEYS,
} from '@/lib/data/crm/getGlobalActivityFeed'
import GlobalActivityFeed from '@/components/admin/crm/GlobalActivityFeed.client'

export const metadata = { title: 'Activity | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ types?: string; broker?: string }>
}) {
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
      </header>

      <GlobalActivityFeed
        initialItems={items}
        initialCursor={nextCursor}
        allTypes={typeChips}
        initialSelected={selected}
        brokerOptions={brokerOptions}
        initialBroker={initialBroker}
      />
    </main>
  )
}
