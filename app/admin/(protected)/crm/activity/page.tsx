// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
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
  searchParams: Promise<{ types?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  // Optional deep-link: ?types=email,sms,website. Absent = all types selected.
  const requested = sp.types
    ? sp.types.split(',').map((t) => t.trim()).filter((t) => ALL_ACTIVITY_TYPE_KEYS.includes(t as never))
    : ALL_ACTIVITY_TYPE_KEYS
  const selected = requested.length ? requested : ALL_ACTIVITY_TYPE_KEYS

  const { items, nextCursor } = await getGlobalActivityFeed({ types: selected, limit: 50 })

  const typeChips = ACTIVITY_TYPES.map((t) => ({ key: t.key, label: t.label }))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every interaction across your contacts, newest first. Toggle the activity types you want to see, then tap a name to open the contact.
        </p>
      </header>

      <GlobalActivityFeed
        initialItems={items}
        initialCursor={nextCursor}
        allTypes={typeChips}
        initialSelected={selected}
      />
    </main>
  )
}
