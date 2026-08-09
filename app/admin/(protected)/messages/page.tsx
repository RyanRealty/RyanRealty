// @no-parity — internal admin surface, no public mockup contract
// Messages (P9 roll:messages, IA lock 2026-08-05): the thread surface — read an
// inbound in context, reply fast, history above a fixed composer (locked
// pattern 2). Reads are lib/data-only; the send goes through the governed SMS
// action via a thin wrapper. Email bodies render as text snippets here — the
// full email composer and heavy tools (templates, drafts, statuses, MMS) stay
// one tap away on /admin/crm/inbox until that machinery migrates.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getInboxFolderQueue } from '@/lib/data/crm/getInboxQueue'
import { getConversationThreadFull, getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { Button, ThreadBubble } from '@/components/admin/v2'
import { sendMessagesSms } from './actions'

export const dynamic = 'force-dynamic'

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

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const ctx = await requireAdminPage('inbox.view')
  const brokerScope = ctx.role === 'superuser' ? null : ctx.brokerSlug
  const selectedId = Number((await searchParams).c) || null

  const [queue, thread, card] = await Promise.all([
    getInboxFolderQueue({
      scopeKey: ctx.role === 'superuser' ? 'company' : 'me',
      folder: 'inbox',
      brokerScope,
      actingBroker: ctx.brokerSlug,
      limit: 50,
    }),
    selectedId ? getConversationThreadFull(selectedId) : Promise.resolve([]),
    selectedId ? getInboxContactCard(selectedId) : Promise.resolve(null),
  ])

  const quiet = inSmsQuietHours()

  // A DIV, not <main>: ConsoleShell already renders this page's one <main>
  // landmark, and a nested second one hands assistive tech two "main content"
  // regions to choose between. Thirty files were de-nested for exactly this in
  // 11C-11E; messages was missed and shipped two until 2026-08-08. av2-scope is
  // styling, never a landmark.
  return (
    <div className={`av2-scope av2-msgs ${selectedId ? 'av2-msgs--thread' : 'av2-msgs--list'}`}>
      <nav className="av2-convlist" aria-label="Conversations">
        {queue.conversations.map((c) => (
          <Link
            key={c.conversationId}
            href={`/admin/messages?c=${c.personId}`}
            className={`av2-conv${c.personId === selectedId ? ' av2-conv--current' : ''}`}
          >
            <span className="av2-conv__name">
              {c.status === 'unread' ? <span className="av2-conv__unread" aria-label="Unread" /> : null}
              {c.name ?? 'Unknown contact'}
            </span>
            <span className="av2-conv__ts">{c.lastKindLabel}</span>
            <span className="av2-conv__snippet">{c.snippet ?? ''}</span>
          </Link>
        ))}
        {queue.conversations.length === 0 ? (
          <div className="av2-sysnote" style={{ padding: 24 }}>
            Inbox is clear.
          </div>
        ) : null}
      </nav>

      {selectedId ? (
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
              <Link href={`/admin/crm/inbox?c=${selectedId}`}>
                <Button variant="quiet">All tools</Button>
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
            <form action={sendMessagesSms}>
              <div className="av2-composer__box">
                <input type="hidden" name="personId" value={selectedId} />
                <textarea name="body" rows={1} required aria-label="Reply" placeholder="Reply by text…" />
                <Button type="submit" touch>
                  Send
                </Button>
              </div>
              <div className="av2-composer__row">
                <span>Texts go through the governed send path.</span>
                <span className={quiet ? 'av2-composer__warn' : 'av2-composer__ok'}>
                  {quiet ? 'Quiet hours — 1:1 manual send allowed' : 'Inside send window'}
                </span>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <section className="av2-thread" aria-label="No conversation selected">
          <div className="av2-scroll">
            <div className="av2-sysnote">Pick a conversation.</div>
          </div>
        </section>
      )}

      <aside className="av2-context" aria-label="Person context">
        {card ? (
          <>
            <div className="av2-context__name">{card.name ?? 'Unknown contact'}</div>
            <div className="av2-context__meta">
              {[card.stage, card.source].filter(Boolean).join(' · ')}
            </div>
            <div className="av2-context__h">Contact</div>
            {card.phone ? (
              <div className="av2-context__row" style={{ fontFamily: 'var(--a-font-mono)' }}>{card.phone}</div>
            ) : null}
            {card.email ? (
              <div className="av2-context__row" style={{ fontFamily: 'var(--a-font-mono)' }}>{card.email}</div>
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
    </div>
  )
}
