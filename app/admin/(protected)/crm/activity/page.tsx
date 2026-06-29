// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getGlobalActivityFeed, type GlobalActivityFilter } from '@/lib/data/crm/getGlobalActivityFeed'
import GlobalActivityFeed from '@/components/admin/crm/GlobalActivityFeed.client'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Activity | Admin' }
export const dynamic = 'force-dynamic'

const TABS: { key: GlobalActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'new_leads', label: 'New leads' },
]

export default async function CrmActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const filter: GlobalActivityFilter =
    TABS.some((t) => t.key === sp.filter) ? (sp.filter as GlobalActivityFilter) : 'all'

  const { items, nextCursor } = await getGlobalActivityFeed({ filter, limit: 50 })

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email, website action, and new lead across your contacts, newest first. Tap a name to open the contact.
        </p>
      </header>

      <nav aria-label="Activity filters" className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => {
          const isActive = t.key === filter
          return (
            <Link
              key={t.key}
              href={t.key === 'all' ? '/admin/crm/activity' : `/admin/crm/activity?filter=${t.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/50',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      <GlobalActivityFeed key={filter} initialItems={items} initialCursor={nextCursor} filter={filter} />
    </main>
  )
}
