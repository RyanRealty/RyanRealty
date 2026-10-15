import Link from 'next/link'
import { getRecentMessageConversations } from '@/lib/data/crm/getMessagesInbox'
import { getInboxFolderQueue, type InboxFolderKey } from '@/lib/data/crm/getInboxQueue'
import { filterMessageThreads } from '@/lib/admin/messages-thread-filter'
import { HiddenField, SearchField } from '@/components/admin/v2'
import { MessagesFolderSelect } from './MessagesFolderSelect'
import { QueueQuickDone } from './QueueQuickDone'
import { QueueDoneAll } from './QueueDoneAll'

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
 * The conversation list. Needs attention (inbox) is the default — a fast
 * needs_reply page, not the 4,000-row folder builder. Recent / other folders
 * stay opt-in. Unnamed listing-alert threads are hidden unless ?auto=1.
 */
export async function MessagesQueue({
  brokerScope,
  actingBroker,
  selectedId,
  folder,
  q = '',
  showAutomation = false,
}: {
  brokerScope: string | null
  actingBroker: string | null
  selectedId: number | null
  folder: MessagesFolder
  q?: string
  showAutomation?: boolean
}) {
  let rows: QueueRow[]
  if (folder === 'inbox' || folder === 'recent') {
    const conversations = await getRecentMessageConversations({
      brokerScope,
      limit: q ? 80 : 40,
      needsReply: folder === 'inbox',
    })
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

  const visible = filterMessageThreads(rows, { q, showAutomation })
  const hiddenCount = rows.length - filterMessageThreads(rows, { q: '', showAutomation: false }).length

  const threadHref = (personId: number) => {
    const params = new URLSearchParams()
    if (folder !== 'inbox') params.set('f', folder)
    params.set('c', String(personId))
    if (q) params.set('q', q)
    if (showAutomation) params.set('auto', '1')
    return `/admin/messages?${params.toString()}`
  }

  return (
    <nav className="av2-convlist" aria-label="Conversations">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '12px 16px 8px' }}>
        <div style={{ flex: '0 0 auto', minWidth: '12.5rem' }}>
          <MessagesFolderSelect current={folder} />
        </div>
        {folder !== 'recent' && folder !== 'closed' ? (
          <QueueDoneAll personIds={[...new Set(visible.map((r) => r.personId))]} />
        ) : null}
        <Link href="/admin/messages/new" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          New message
        </Link>
      </div>
      <form method="get" style={{ padding: '0 16px 8px' }}>
        {folder !== 'inbox' ? <HiddenField name="f" value={folder} /> : null}
        {showAutomation ? <HiddenField name="auto" value="1" /> : null}
        {selectedId ? <HiddenField name="c" value={String(selectedId)} /> : null}
        <SearchField
          name="q"
          defaultValue={q}
          placeholder="Search threads"
          aria-label="Search threads"
          style={{ width: '100%' }}
        />
      </form>
      {hiddenCount > 0 && !showAutomation ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', padding: '0 16px 8px' }}>
          {hiddenCount} automation thread{hiddenCount === 1 ? '' : 's'} hidden.{' '}
          <Link href={`/admin/messages?${folder !== 'inbox' ? `f=${folder}&` : ''}auto=1`} style={{ color: 'var(--a-accent)' }}>
            Show
          </Link>
        </p>
      ) : null}
      {visible.map((c) => (
        <div key={c.key} style={{ display: 'flex', alignItems: 'center' }}>
          <Link
            href={threadHref(c.personId)}
            className={`av2-conv${c.personId === selectedId ? ' av2-conv--current' : ''}`}
            style={{ flex: 1, minWidth: 0 }}
          >
            <span className="av2-conv__name">
              {c.unread ? <span className="av2-conv__unread" aria-label="Unread" /> : null}
              {c.name ?? 'Unknown contact'}
            </span>
            <span className="av2-conv__ts">{c.lastKindLabel}</span>
            <span className="av2-conv__snippet">{c.snippet ?? ''}</span>
          </Link>
          {folder !== 'recent' && folder !== 'closed' ? (
            <span style={{ paddingRight: 8 }}>
              <QueueQuickDone personId={c.personId} />
            </span>
          ) : null}
        </div>
      ))}
      {visible.length === 0 ? (
        <div className="av2-sysnote" style={{ padding: 24 }}>
          {q
            ? 'No threads match that search.'
            : folder === 'inbox'
              ? 'Nothing needs attention.'
              : folder === 'recent'
                ? 'No recent threads. Start a new text.'
                : 'Nothing in this folder.'}
        </div>
      ) : null}
    </nav>
  )
}
