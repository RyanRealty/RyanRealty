/**
 * InboxFolderRail — the left folder tree of the FUB three-panel inbox
 * (spec §08 §3). Server component: Compose button (client child), the global
 * unread header, then MY INBOX and COMPANY sections each with the five FUB
 * folders (Inbox / Assigned / Drafts / Sent / Closed) and live count badges.
 * Active folder: left border accent + navy tint (spec §3.1).
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InboxFolderCounts, InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'
import { inboxHref } from '@/components/admin/crm/inbox/inbox-url'
import ComposeButton from '@/components/admin/crm/inbox/ComposeButton'

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
      <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}{' '}
        <span className="tabular-nums font-normal">({counts.inbox})</span>
      </div>
      {FOLDER_LABELS.map((f) => {
        const active = activeScope === scopeKey && activeFolder === f.key
        const count = counts[f.key]
        return (
          <Link
            key={f.key}
            href={inboxHref({ scope: scopeKey, folder: f.key, view })}
            className={cn(
              'flex items-center justify-between border-l-2 py-1.5 pl-5 pr-3 text-sm transition-colors',
              active
                ? 'border-primary bg-primary/5 font-semibold text-foreground'
                : 'border-transparent text-foreground hover:bg-primary/5',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span>{f.label}</span>
            {count > 0 ? (
              <Badge variant="secondary" className="tabular-nums px-1.5 py-0 text-xs font-normal">
                {count}
              </Badge>
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
      <div className="px-4 pb-1 text-xs text-muted-foreground tabular-nums">
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
      <div className="mx-4 my-2 border-t border-border" />
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
