// @no-parity — internal admin surface, no public mockup contract
// People: new-contact first, then lookup. Search by name or contact. No book-wide dump.
import { Suspense } from 'react'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker } from '@/lib/crm/scope'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { getPeopleListSignals } from '@/lib/data/crm/getPeopleListSignals'
import { SectionHead, StateWord } from '@/components/admin/v2'
import { AddPersonCard } from '@/components/admin/shared/people-list/AddPersonDialog'
import '@/components/admin/v2/admin-v2.css'

export const dynamic = 'force-dynamic'

async function RecentlyTouched({
  q,
  brokerScope,
}: {
  q: string | null
  brokerScope: string | null
}) {
  const hits = await searchCrmPeople({ q, brokerScope, limit: 25 })
  const signals = await getPeopleListSignals(hits.map((p) => p.id))

  return (
    <>
      <SectionHead>{q ? `Results for "${q}"` : 'Recently touched'}</SectionHead>
      <ul className="av2-queue">
        {hits.map((p) => {
          const next = signals.get(p.id)?.nextLine
          const nextLine = next && next !== 'No next step queued.' ? next : null
          return (
          <li key={p.id} className="av2-qrow">
            <span className="av2-qrow__kind">
              <StateWord state="accent">{p.stage ?? 'Lead'}</StateWord>
            </span>
            <div className="av2-qrow__body">
              <div className="av2-qrow__title">
                <Link href={`/admin/people/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {p.name ?? 'Unknown contact'}
                </Link>
              </div>
              <div className="av2-qrow__ctx">
                {[nextLine, p.phones?.[0]?.value, p.emails?.[0]?.value].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className="av2-qrow__act">
              <Link href={`/admin/people/${p.id}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                Open
              </Link>
            </span>
          </li>
          )
        })}
        {hits.length === 0 ? (
          <li className="av2-sysnote" style={{ padding: 16 }}>
            {q ? 'No one matches. Try fewer letters, or a phone fragment.' : 'No people yet.'}
          </li>
        ) : null}
      </ul>
    </>
  )
}

function RecentlyTouchedFallback() {
  return (
    <div aria-busy="true" style={{ padding: '8px 0' }}>
      <SectionHead>Recently touched</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading recent people.</p>
    </div>
  )
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireAdminPage('people.view')
  const brokerScope = scopeBroker(ctx)
  const q = ((await searchParams).q ?? '').trim() || null

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <AddPersonCard />

      <form method="GET" style={{ margin: '0 0 20px' }}>
        <input
          className="av2-input"
          style={{ width: '100%' }}
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, phone, or email"
          aria-label="Search people"
        />
      </form>

      <Suspense fallback={<RecentlyTouchedFallback />}>
        <RecentlyTouched q={q} brokerScope={brokerScope} />
      </Suspense>
    </div>
  )
}
