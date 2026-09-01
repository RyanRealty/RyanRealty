// @no-parity — internal admin surface, no public mockup contract
// Messages: thread + compose first. The conversation list streams so this
// page cannot hang on the full CRM inbox working set.
import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/admin/v2'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker } from '@/lib/crm/scope'
import { MessagesQueue, type MessagesFolder } from './MessagesQueue'
import { MessagesThread } from './MessagesThread'

export const dynamic = 'force-dynamic'

function QueueFallback() {
  return (
    <nav className="av2-convlist" aria-label="Conversations">
      <div style={{ padding: '12px 16px 8px' }}>
        <Link href="/admin/messages/new" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          New message
        </Link>
      </div>
      <div className="av2-sysnote" style={{ padding: 24 }}>
        Loading recent threads.
      </div>
    </nav>
  )
}

function ThreadFallback() {
  return (
    <section className="av2-thread" aria-label="Thread">
      <div className="av2-scroll">
        <div className="av2-sysnote">Opening this thread.</div>
      </div>
    </section>
  )
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; f?: string }>
}) {
  const ctx = await requireAdminPage('inbox.view')
  const access = { email: ctx.email, role: ctx.role, brokerSlug: ctx.brokerSlug }
  const brokerScope = scopeBroker(ctx)
  const sp = await searchParams
  const selectedId = Number(sp.c) || null
  const folder: MessagesFolder =
    sp.f === 'inbox' || sp.f === 'assigned' || sp.f === 'drafts' || sp.f === 'sent' || sp.f === 'closed'
      ? sp.f
      : 'recent'

  return (
    <div className={`av2-scope av2-msgs ${selectedId ? 'av2-msgs--thread' : 'av2-msgs--list'}`}>
      <Suspense fallback={<QueueFallback />}>
        <MessagesQueue brokerScope={brokerScope} actingBroker={ctx.brokerSlug} selectedId={selectedId} folder={folder} />
      </Suspense>

      {selectedId && access ? (
        <Suspense fallback={<ThreadFallback />}>
          <MessagesThread personId={selectedId} access={access} />
        </Suspense>
      ) : (
        <section className="av2-thread" aria-label="No conversation selected">
          <div className="av2-scroll">
            <div className="av2-sysnote">
              Pick a conversation, or start a new message.
              <div style={{ marginTop: 12 }}>
                <Link href="/admin/messages/new" style={{ textDecoration: 'none' }}>
                  <Button variant="quiet">New message</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
