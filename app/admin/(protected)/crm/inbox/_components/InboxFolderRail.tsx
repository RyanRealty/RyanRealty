/**
 * InboxFolderRail — the left folder tree of the FUB three-panel inbox
 * (spec §08 §3). Server component: Compose button (client child), the global
 * unread header, then MY INBOX and COMPANY sections each with the five FUB
 * folders (Inbox / Assigned / Drafts / Sent / Closed) and live count badges.
 * Active folder: accent wash + accent text, via the av2-rail__item
 * [aria-current="page"] rule (admin v2 language, design_system/admin/ADMIN_UI.md).
 */

import Link from 'next/link'
import '@/components/admin/v2/admin-v2.css'
import type { InboxFolderCounts, InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'
import { inboxHref } from './inbox-url'
import ComposeButton from './ComposeButton'

const FOLDER_LABELS: Array<{ key: InboxFolderKey; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'closed', label: 'Closed' },
]

function FolderSection({
  scopeKey,
  heading,
  counts,
  activeScope,
  activeFolder,
  view,
}: {
  scopeKey: InboxScopeKey
  heading: string
  counts: InboxFolderCounts
  activeScope: InboxScopeKey
  activeFolder: InboxFolderKey
  view: 'all' | 'unread'
}) {
  return (
    <div>
      <div className="av2-rail__group">
        {heading} <span className="a-num" style={{ fontWeight: 400 }}>({counts.inbox})</span>
      </div>
      {FOLDER_LABELS.map((f) => {
        const active = activeScope === scopeKey && activeFolder === f.key
        const count = counts[f.key]
        return (
          <Link
            key={f.key}
            href={inboxHref({ scope: scopeKey, folder: f.key, view })}
            className="av2-rail__item"
            aria-current={active ? 'page' : undefined}
          >
            <span>{f.label}</span>
            {count > 0 ? (
              <span className="av2-rail__count a-num">{count}</span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

export default function InboxFolderRail({
  activeScope,
  activeFolder,
  view,
  meCounts,
  companyCounts,
  unreadTotal,
}: {
  activeScope: InboxScopeKey
  activeFolder: InboxFolderKey
  view: 'all' | 'unread'
  meCounts: InboxFolderCounts
  companyCounts: InboxFolderCounts
  unreadTotal: number
}) {
  return (
    <nav data-tour="inbox-folders" className="flex h-full flex-col py-3" aria-label="Inbox folders">
      <div data-tour="inbox-compose" className="px-3 pb-2">
        <ComposeButton />
      </div>

      {/* Global unread header (spec §3.1) */}
      <div className="px-4 pb-1 a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        {unreadTotal} Unread {unreadTotal === 1 ? 'Message' : 'Messages'}
      </div>

      <FolderSection
        scopeKey="me"
        heading="My Inbox"
        counts={meCounts}
        activeScope={activeScope}
        activeFolder={activeFolder}
        view={view}
      />
      <div className="mx-4 my-2" style={{ borderTop: '1px solid var(--a-border)' }} />
      <FolderSection
        scopeKey="company"
        heading="Company"
        counts={companyCounts}
        activeScope={activeScope}
        activeFolder={activeFolder}
        view={view}
      />
    </nav>
  )
}
