import Link from 'next/link'
import { getConversationThreadFull, getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getConversationTriageState } from '@/lib/data/crm/getConversationTriageState'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { MessagesThreadControls } from './MessagesThreadControls'
import { getDraftsForPerson } from '@/lib/data/crm/drafts'
import { requirePersonInScope } from '@/app/actions/crm'
import { addUnknownCallerPersonAction } from '@/app/actions/crm-inbox'
import { searchPeopleForMergeAction, linkUnknownCallerToPersonAction } from '@/app/actions/crm-person-gaps'
import { isUnknownCaller } from '@/lib/crm/display-name'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { Button, ThreadBubble } from '@/components/admin/v2'
import { ComposeSurface } from '@/components/admin/crm/ComposeSurface'
import AddPersonForm from '@/app/admin/(protected)/crm/inbox/_components/AddPersonForm'
import type { CrmAccess } from '@/app/actions/crm'

function tsLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function channelLabel(kind: string): 'SMS' | 'Email' | null {
  if (kind.startsWith('sms')) return 'SMS'
  if (kind.startsWith('email')) return 'Email'
  return null
}

export async function MessagesThread({
  personId,
  access,
  initialChannel = 'text',
}: {
  personId: number
  access: CrmAccess
  /** Inbox deep-link compat (?m=email): preselect the composer channel. */
  initialChannel?: 'text' | 'email'
}) {
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) {
    return (
      <section className="av2-thread" aria-label="Thread">
        <div className="av2-scroll">
          <div className="av2-sysnote">That contact is outside your book.</div>
        </div>
      </section>
    )
  }

  const canAssign = access.role === 'superuser'
  const [thread, card, drafts, triage, brokers] = await Promise.all([
    getConversationThreadFull(personId, 80),
    getInboxContactCard(personId),
    getDraftsForPerson(personId, access.brokerSlug),
    getConversationTriageState(personId),
    canAssign ? getCrmBrokers() : Promise.resolve([]),
  ])
  const quiet = inSmsQuietHours()

  // Unknown-caller naming (Messages-fold slice 2): the same inline add/link
  // affordance the inbox reading pane carried, so an unidentified caller can
  // be named or merged without leaving the thread.
  const isUnknown = isUnknownCaller(card?.name ?? null)
  async function addPersonFor(
    firstName: string,
    lastName: string,
    email: string,
  ): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await addUnknownCallerPersonAction(personId, firstName, lastName, email)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function searchExistingFor(
    query: string,
  ): Promise<Array<{ id: number; name: string | null; email: string | null; phone: string | null }>> {
    'use server'
    const hits = await searchPeopleForMergeAction(query, personId)
    return hits.map((h) => ({ id: h.id, name: h.name, email: h.email, phone: h.phone }))
  }
  async function linkExistingFor(existingId: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await linkUnknownCallerToPersonAction(existingId, personId)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return (
    <>
      <section className="av2-thread" aria-label="Thread">
        <header className="av2-threadhead">
          <Link href="/admin/messages" className="av2-back">
            <Button variant="quiet">‹ Back</Button>
          </Link>
          <div>
            <div className="av2-threadhead__name">{card?.name ?? 'Unknown contact'}</div>
            <div className="av2-threadhead__meta">
              {[card?.stage, card?.assignedBroker ? `assigned ${card.assignedBroker}` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <MessagesThreadControls
              personId={personId}
              status={triage.status}
              assignee={triage.assignedBroker ?? ''}
              brokerOptions={brokers.filter((b) => b.crmActive).map((b) => ({ value: b.slug, label: b.name || b.slug }))}
              canAssign={canAssign}
            />
            <Link href={`/admin/people/${personId}`}>
              <Button variant="quiet">Person</Button>
            </Link>
          </span>
        </header>

        <div className="av2-scroll">
          {thread.map((m) => {
            const chan = channelLabel(m.kind)
            if (m.direction !== 'in' && m.direction !== 'out') {
              return (
                <div key={m.id} className="av2-sysnote">
                  {m.label} · {tsLabel(m.ts)}
                </div>
              )
            }
            const body =
              chan === 'Email'
                ? (m.subject ? `${m.subject} — ` : '') + (m.snippet ?? m.label)
                : (m.fullBody ?? m.snippet ?? m.label)
            return (
              <ThreadBubble
                key={m.id}
                direction={m.direction}
                channel={chan ?? undefined}
                stamp={`${tsLabel(m.ts)}${m.delivery ? ` · ${m.delivery.label}` : ''}`}
              >
                {body}
              </ThreadBubble>
            )
          })}
          {thread.length === 0 ? <div className="av2-sysnote">No messages yet.</div> : null}
        </div>

        {isUnknown ? (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--a-border)' }}>
            <AddPersonForm
              phone={card?.phone ?? null}
              addAction={addPersonFor}
              searchAction={searchExistingFor}
              linkAction={linkExistingFor}
            />
          </div>
        ) : null}

        <div className="av2-composer">
          <ComposeSurface
            initialChannel={initialChannel}
            initialPeople={
              card
                ? [
                    {
                      id: card.personId,
                      name: card.name ?? 'Unknown contact',
                      phone: card.phone,
                      email: card.email,
                    },
                  ]
                : []
            }
            quiet={quiet}
            draftText={drafts.text?.body ?? ''}
            draftEmail={drafts.email?.body ?? ''}
            draftSubject={drafts.email?.subject ?? ''}
          />
        </div>
      </section>

      <aside className="av2-context" aria-label="Person context">
        {card ? (
          <>
            <div className="av2-context__name">{card.name ?? 'Unknown contact'}</div>
            <div className="av2-context__meta">{[card.stage, card.source].filter(Boolean).join(' · ')}</div>
            <div className="av2-context__h">Contact</div>
            {card.phone ? (
              <div className="av2-context__row" style={{ fontFamily: 'var(--a-font-mono)' }}>
                {card.phone}
              </div>
            ) : null}
            {card.email ? (
              <div className="av2-context__row" style={{ fontFamily: 'var(--a-font-mono)' }}>
                {card.email}
              </div>
            ) : null}
            <div className="av2-context__h">Record</div>
            <div className="av2-context__row">
              <Link href={`/admin/people/${card.personId}`} style={{ color: 'var(--a-accent)' }}>
                Open full person record
              </Link>
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}
