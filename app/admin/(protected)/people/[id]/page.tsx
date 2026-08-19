// @no-parity — internal admin surface, no public mockup contract
// Person entity page. First paint is the detailed add: identity, address,
// stage, tags, related people, and notes. Messages and tools stream after.
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getPersonNotes } from '@/lib/data/crm/getPersonNotes'
import { requirePersonInScope } from '@/app/actions/crm'
import { formatPersonAddress } from '@/lib/crm/person-address'
import { LEAD_SOURCE_OPTIONS } from '@/components/admin/shared/people-list/people-list-utils'
import { Button, SectionHead } from '@/components/admin/v2'
import {
  addTagFromPerson,
  assignBrokerFromPerson,
  removeTagFromPerson,
  updateSourceFromPerson,
  updateStageFromPerson,
} from '../actions'
import { PersonIdentityHeader } from './PersonIdentityHeader'
import { PersonAddressEditor } from './PersonAddressEditor'
import { FieldEditors } from './FieldEditors'
import { PersonRelationships } from './PersonRelationships'
import { PersonNotesAdd } from './PersonNotesAdd'
import { PersonWorkspace } from './PersonWorkspace'
import { CmaKickoffSheet } from '@/components/admin/crm/CmaKickoffSheet'

export const dynamic = 'force-dynamic'

function PersonWorkspaceFallback() {
  return (
    <div aria-busy="true" style={{ padding: '8px 0' }}>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Loading messages and activity.
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

  const [card, relationships, notes] = await Promise.all([
    getInboxContactCard(idNum),
    getContactRelationships(idNum),
    getPersonNotes(idNum),
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

      <CmaKickoffSheet
        personId={card.personId}
        personName={card.name}
        personPhone={card.phone}
        personEmail={card.email}
        suggestedAddress={addressLine}
        autoOpen={sp.intent === 'cma'}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {card.phone ? (
          <Link href={`/admin/messages/new?c=${card.personId}`}>
            <Button>Text</Button>
          </Link>
        ) : null}
        <Link href={`/admin/messages?c=${card.personId}`}>
          <Button variant="quiet">Message</Button>
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

      <section aria-label="Stage and tags" style={{ margin: '0 0 20px' }}>
        <SectionHead>Stage and tags</SectionHead>
        <FieldEditors
          stage={card.stage}
          assignedBroker={card.assignedBroker}
          canReassign={ctx.role === 'superuser'}
          source={card.source}
          sources={[...LEAD_SOURCE_OPTIONS]}
          tags={card.tags}
          updateStage={updateStageFromPerson.bind(null, card.personId)}
          assignBroker={assignBrokerFromPerson.bind(null, card.personId)}
          updateSource={updateSourceFromPerson.bind(null, card.personId)}
          addTag={addTagFromPerson.bind(null, card.personId)}
          removeTag={removeTagFromPerson.bind(null, card.personId)}
        />
      </section>

      <PersonRelationships personId={card.personId} relationships={relationships} />
      <PersonNotesAdd personId={card.personId} notes={notes} />

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
