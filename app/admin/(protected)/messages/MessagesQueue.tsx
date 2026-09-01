import Link from 'next/link'
import { getRecentMessageConversations } from '@/lib/data/crm/getMessagesInbox'
import { getInboxFolderQueue, type InboxFolderKey } from '@/lib/data/crm/getInboxQueue'
import { MessagesFolderSelect } from './MessagesFolderSelect'

export type MessagesFolder = 'recent' | InboxFolderKey

type QueueRow = {
  key: string
  personId: number
  name: string | null
  unread: boolean
  lastKindLabel: string
  snippet: string | null
}

/**
 * The conversation list. "Recent" (default) is the fast newest-first read the
 * page has always used; a picked folder switches to the inbox triage read
 * (Messages-fold slice 1, Matt lock 2026-09-01 #1 — the folder rail becomes
 * one compact select here).
 */
export async function MessagesQueue({
  brokerScope,
  actingBroker,
  selectedId,
  folder,
}: {
  brokerScope: string | null
  actingBroker: string | null
  selectedId: number | null
  folder: MessagesFolder
}) {
  let rows: QueueRow[]
  if (folder === 'recent') {
    const conversations = await getRecentMessageConversations({ brokerScope, limit: 40 })
    rows = conversations.map((c) => ({
      key: String(c.personId),
      personId: c.personId,
      name: c.name,
      unread: c.unread,
      lastKindLabel: c.lastKindLabel,
      snippet: c.snippet,
    }))
  } else {
    const { conversations } = await getInboxFolderQueue({
      scopeKey: brokerScope ? 'me' : 'company',
      folder,
      brokerScope,
      actingBroker,
      limit: 40,
    })
    rows = conversations.map((c) => ({
      key: c.conversationId,
      personId: c.personId,
      name: c.name,
      unread: c.status === 'unread' || c.needsReply,
      lastKindLabel: c.lastKindLabel,
      snippet: c.snippet,
    }))
  }

  const threadHref = (personId: number) =>
    folder === 'recent' ? `/admin/messages?c=${personId}` : `/admin/messages?f=${folder}&c=${personId}`

  return (
    <nav className="av2-convlist" aria-label="Conversations">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px 8px' }}>
        <div style={{ flex: 1 }}>
          <MessagesFolderSelect current={folder} />
        </div>
        <Link href="/admin/messages/new" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          New message
        </Link>
      </div>
      {rows.map((c) => (
        <Link
          key={c.key}
          href={threadHref(c.personId)}
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
      {rows.length === 0 ? (
        <div className="av2-sysnote" style={{ padding: 24 }}>
          {folder === 'recent' ? 'No recent threads. Start a new text.' : 'Nothing in this folder.'}
        </div>
      ) : null}
    </nav>
  )
}
