import Link from 'next/link'
import { getRecentMessageConversations } from '@/lib/data/crm/getMessagesInbox'

export async function MessagesQueue({
  brokerScope,
  selectedId,
}: {
  brokerScope: string | null
  selectedId: number | null
}) {
  const conversations = await getRecentMessageConversations({ brokerScope, limit: 40 })

  return (
    <nav className="av2-convlist" aria-label="Conversations">
      <div style={{ padding: '12px 16px 8px' }}>
        <Link href="/admin/messages/new" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          New text
        </Link>
      </div>
      {conversations.map((c) => (
        <Link
          key={c.personId}
          href={`/admin/messages?c=${c.personId}`}
          className={`av2-conv${c.personId === selectedId ? ' av2-conv--current' : ''}`}
        >
          <span className="av2-conv__name">
            {c.unread ? <span className="av2-conv__unread" aria-label="Unread" /> : null}
            {c.name ?? 'Unknown contact'}
          </span>
          <span className="av2-conv__ts">{c.lastKindLabel}</span>
          <span className="av2-conv__snippet">{c.snippet ?? ''}</span>
        </Link>
      ))}
      {conversations.length === 0 ? (
        <div className="av2-sysnote" style={{ padding: 24 }}>
          No recent threads. Start a new text.
        </div>
      ) : null}
    </nav>
  )
}
