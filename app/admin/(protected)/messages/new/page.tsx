// @no-parity — internal admin surface, no public mockup contract
// Compose a text without waiting for the inbox working set.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker } from '@/lib/crm/scope'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { Button, EntityTitle, SearchField } from '@/components/admin/v2'
import { MessagesComposer } from '../MessagesComposer.client'

export const dynamic = 'force-dynamic'

export default async function MessagesNewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string }>
}) {
  const ctx = await requireAdminPage('inbox.send')
  const access = await getCrmAccess()
  if (!access) notFound()
  const brokerScope = scopeBroker(ctx)
  const sp = await searchParams
  const selectedId = Number(sp.c) || null
  const q = (sp.q ?? '').trim() || null

  if (selectedId) {
    const scoped = await requirePersonInScope(selectedId, access)
    if (!scoped.ok) notFound()
    const card = await getInboxContactCard(selectedId)
    if (!card) notFound()
    const quiet = inSmsQuietHours()
    return (
      <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <p style={{ fontSize: 'var(--a-text-xs)', margin: '0 0 12px' }}>
          <Link href="/admin/messages" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            Messages
          </Link>
        </p>
        <EntityTitle>Text {card.name ?? 'this contact'}</EntityTitle>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
          {[card.phone, card.email].filter(Boolean).join(' · ') || 'No phone on file.'}
        </p>
        <div className="av2-composer">
          <MessagesComposer personId={card.personId} quiet={quiet} hasPhone={Boolean(card.phone)} />
        </div>
      </div>
    )
  }

  const hits = await searchCrmPeople({ q, brokerScope, limit: 25 })

  return (
    <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <p style={{ fontSize: 'var(--a-text-xs)', margin: '0 0 12px' }}>
        <Link href="/admin/messages" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Messages
        </Link>
      </p>
      <EntityTitle>New text</EntityTitle>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Search a contact, then send from the business line.
      </p>
      <form action="/admin/messages/new" method="get" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <SearchField name="q" defaultValue={q ?? ''} placeholder="Name, phone, or email" aria-label="Find a contact" />
        <Button type="submit" variant="quiet">
          Find
        </Button>
      </form>
      <ul className="av2-queue">
        {hits.map((p) => (
          <li key={p.id} className="av2-qrow">
            <div className="av2-qrow__body">
              <div className="av2-qrow__title">
                <Link href={`/admin/messages/new?c=${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {p.name ?? 'Unknown contact'}
                </Link>
              </div>
              <div className="av2-qrow__ctx">
                {[p.phones?.[0]?.value, p.emails?.[0]?.value].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className="av2-qrow__act">
              <Link href={`/admin/messages/new?c=${p.id}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                Text
              </Link>
            </span>
          </li>
        ))}
        {hits.length === 0 ? (
          <li className="av2-sysnote" style={{ padding: 16 }}>
            {q ? 'No one matches.' : 'Search a name or phone to start a text.'}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
