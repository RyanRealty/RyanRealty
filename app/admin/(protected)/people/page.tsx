// @no-parity — internal admin surface, no public mockup contract
// People (P9 roll:people, IA lock 2026-08-05): search-first LOOKUP, not a
// worklist (Matt Q2: the 22,951-row list is not weekly). One search field over
// name + contact points; no term = recently touched. The full legacy list with
// segments/saved views stays at /admin/crm until that machinery migrates.
// (This URL was a redirect bridge from the 2026-07-07 consolidation — the
// destination returns here under its job name.)
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { StateWord } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireAdminPage('people.view')
  const brokerScope = ctx.role === 'superuser' ? null : ctx.brokerSlug
  const q = ((await searchParams).q ?? '').trim() || null

  const hits = await searchCrmPeople({ q, brokerScope, limit: 25 })

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <form method="GET" style={{ margin: '12px 0 20px' }}>
        <input
          className="av2-input"
          style={{ width: '100%' }}
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, phone, or email…"
          aria-label="Search people"
          autoFocus
        />
      </form>

      <h2 className="av2-lane-head">{q ? `Results for “${q}”` : 'Recently touched'}</h2>
      <ul className="av2-queue">
        {hits.map((p) => (
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
                {[p.phones?.[0]?.value, p.emails?.[0]?.value, p.assigned_broker ? `assigned ${p.assigned_broker}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <span className="av2-qrow__act">
              <Link href={`/admin/people/${p.id}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                Open
              </Link>
            </span>
          </li>
        ))}
        {hits.length === 0 ? (
          <li className="av2-sysnote" style={{ padding: 16 }}>
            {q ? 'No one matches. Try fewer letters, or a phone fragment.' : 'No people yet.'}
          </li>
        ) : null}
      </ul>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Need segments, saved views, or bulk tools?{' '}
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
          Open the full list
        </Link>
        .
      </p>
    </main>
  )
}
