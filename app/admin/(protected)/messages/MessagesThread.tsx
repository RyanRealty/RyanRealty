import Link from 'next/link'
import { getConversationThreadFull, getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getDraftsForPerson } from '@/lib/data/crm/drafts'
import { requirePersonInScope } from '@/app/actions/crm'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { Button, ThreadBubble } from '@/components/admin/v2'
import { ComposeSurface } from '@/components/admin/crm/ComposeSurface'
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
}: {
  personId: number
  access: CrmAccess
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

  const [thread, card, drafts] = await Promise.all([
    getConversationThreadFull(personId, 80),
    getInboxContactCard(personId),
    getDraftsForPerson(personId, access.brokerSlug),
  ])
  const quiet = inSmsQuietHours()

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
          <span style={{ marginLeft: 'auto' }}>
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

        <div className="av2-composer">
          <ComposeSurface
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
