// @no-parity — internal admin surface, no public mockup contract
// Person entity page. First paint is identity + address from one card read.
// Stage, tags, assignment, relationships, notes, and comms stream in
// PersonWorkspace so the page does not hang on skeleton after create.
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { requirePersonInScope } from '@/app/actions/crm'
import { formatPersonAddress } from '@/lib/crm/person-address'
import { addNoteFromPerson } from '../actions'
import { Button } from '@/components/admin/v2'
import { PersonIdentityHeader } from './PersonIdentityHeader'
import { PersonAddressEditor } from './PersonAddressEditor'
import { PersonRelationships } from './PersonRelationships'
import { PersonNotesAdd } from './PersonNotesAdd'
import { PersonWorkspace } from './PersonWorkspace'

export const dynamic = 'force-dynamic'

function PersonWorkspaceFallback() {
  return (
    <div aria-busy="true" style={{ padding: '8px 0' }}>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Loading stage, tags, notes, and messages.
      </p>
    </div>
  )
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    intent?: string
    kicked?: string
    err?: string
    tpl?: string
    smsTpl?: string
    flash?: string
    error?: string
    replyChannel?: string
  }>
}) {
  const ctx = await requireAdminPage('people.view')
  const idNum = Number((await params).id)
  if (!Number.isFinite(idNum) || idNum <= 0) notFound()
  const sp = await searchParams

  const inScope = await requirePersonInScope(idNum, {
    email: ctx.email,
    role: ctx.role,
    brokerSlug: ctx.brokerSlug,
  })
  if (!inScope.ok) notFound()

  const [card, relationships] = await Promise.all([
    getInboxContactCard(idNum),
    getContactRelationships(idNum),
  ])
  if (!card) {
    const mapped = await getPersonIdByLegacyId(idNum)
    if (mapped) redirect(`/admin/people/${mapped}`)
    notFound()
  }

  const addressLine = card.address ? formatPersonAddress(card.address) : null

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <PersonIdentityHeader
        name={card.name}
        whoLabels={[]}
        stage={card.stage}
        assignedBroker={card.assignedBroker}
        phone={card.phone}
        email={card.email}
        addressLine={addressLine}
        source={card.source}
        price={card.price}
        timeframe={card.timeframe}
        tags={card.tags}
      />

      <PersonAddressEditor personId={card.personId} address={card.address} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Link href={`/admin/messages?c=${card.personId}`}>
          <Button>Message</Button>
        </Link>
        {card.phone ? (
          <a href={`tel:${card.phone}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Call
          </a>
        ) : null}
        {card.email ? (
          <a href={`mailto:${card.email}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Email
          </a>
        ) : null}
        {sp.intent !== 'cma' && sp.kicked !== '1' ? (
          <Link href={`/admin/people/${card.personId}?intent=cma`}>
            <Button variant="quiet">Build a CMA</Button>
          </Link>
        ) : null}
        <Link href={`/admin/people/${card.personId}/tools`}>
          <Button variant="quiet">All tools</Button>
        </Link>
      </div>

      {sp.flash ? (
        <div style={{ marginBottom: 12, fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', fontWeight: 500 }}>
          {sp.flash}
        </div>
      ) : null}
      {sp.error ? (
        <div style={{ marginBottom: 12, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', fontWeight: 500 }}>
          {sp.error}
        </div>
      ) : null}

      <PersonRelationships personId={card.personId} relationships={relationships} />
      <PersonNotesAdd addNote={addNoteFromPerson.bind(null, card.personId)} />

      <Suspense fallback={<PersonWorkspaceFallback />}>
        <PersonWorkspace
          idNum={idNum}
          card={card}
          sp={{
            intent: sp.intent,
            kicked: sp.kicked,
            err: sp.err,
            tpl: sp.tpl,
            smsTpl: sp.smsTpl,
            replyChannel: sp.replyChannel,
          }}
        />
      </Suspense>
    </div>
  )
}
