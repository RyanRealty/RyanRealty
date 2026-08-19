// @no-parity — internal admin surface, no public mockup contract
// One compose surface. Does not wait on the inbox working set.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getDraftsForPerson } from '@/lib/data/crm/drafts'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { EntityTitle } from '@/components/admin/v2'
import { ComposeSurface } from '@/components/admin/crm/ComposeSurface'
import { getBrokerSelfComposePreviewAction } from '@/app/admin/(protected)/messages/actions'
import type { ComposePersonChip } from '@/lib/crm/compose-group'

export const dynamic = 'force-dynamic'

export default async function MessagesNewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; channel?: string; self?: string; cma?: string }>
}) {
  const ctx = await requireAdminPage('inbox.send')
  const access = await getCrmAccess()
  if (!access) notFound()
  const sp = await searchParams
  const selectedId = Number(sp.c) || null
  const channel = sp.channel === 'email' ? 'email' : 'text'
  const quiet = inSmsQuietHours()
  const brokerSelf = sp.self === '1'
  const cmaSlug = (sp.cma ?? '').trim().toLowerCase()

  let initialPeople: ComposePersonChip[] = []
  let draftText = ''
  let draftEmail = ''
  let draftSubject = ''

  if (brokerSelf) {
    const preview = await getBrokerSelfComposePreviewAction(cmaSlug)
    initialPeople = [{ id: 0, name: preview.name, phone: preview.phone, email: preview.email }]
    draftText = preview.body
    draftEmail = preview.body
    draftSubject = preview.subject
  } else if (selectedId) {
    const scoped = await requirePersonInScope(selectedId, access)
    if (!scoped.ok) notFound()
    const [card, drafts] = await Promise.all([
      getInboxContactCard(selectedId),
      getDraftsForPerson(selectedId, ctx.brokerSlug),
    ])
    if (!card) notFound()
    initialPeople = [
      {
        id: card.personId,
        name: card.name ?? 'Unknown contact',
        phone: card.phone,
        email: card.email,
      },
    ]
    draftText = drafts.text?.body ?? ''
    draftEmail = drafts.email?.body ?? ''
    draftSubject = drafts.email?.subject ?? ''
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <p style={{ fontSize: 'var(--a-text-xs)', margin: '0 0 12px' }}>
        <Link href="/admin/messages" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Messages
        </Link>
      </p>
      <EntityTitle>{initialPeople[0] ? `To ${initialPeople[0].name}` : 'New message'}</EntityTitle>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Text or email. Add people with +. Two people is a group.
      </p>
      <ComposeSurface
        initialPeople={initialPeople}
        initialChannel={channel}
        quiet={quiet}
        draftText={draftText}
        draftEmail={draftEmail}
        draftSubject={draftSubject}
        cmaSlug={cmaSlug}
        brokerSelf={brokerSelf}
      />
    </div>
  )
}
