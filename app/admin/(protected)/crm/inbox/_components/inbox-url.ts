/**
 * inbox-url — pure href builder for the FUB scope × folder inbox routing
 * (spec §08 §1). Query-param routing on the single /admin/crm/inbox page:
 *   ?scope=me|company & folder=inbox|assigned|drafts|sent|closed
 *   & view=unread (All/Unread toggle) & c=<personId> (open thread)
 * Shared by the server page and the client controls so every link agrees.
 */

import { formatDateTime } from '@/lib/format/date'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import type { InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'

export type InboxHrefParams = {
  scope: 'me' | 'company'
  folder: 'inbox' | 'assigned' | 'drafts' | 'sent' | 'closed'
  view?: 'all' | 'unread'
  c?: number | null
}

export function inboxHref(p: InboxHrefParams): string {
  const qs = new URLSearchParams()
  qs.set('scope', p.scope)
  qs.set('folder', p.folder)
  if (p.view === 'unread') qs.set('view', 'unread')
  if (p.c) qs.set('c', String(p.c))
  return `/admin/crm/inbox?${qs.toString()}`
}

export const FOLDER_TITLES: Record<InboxFolderKey, string> = {
  inbox: 'Inbox',
  assigned: 'Assigned',
  drafts: 'Drafts',
  sent: 'Sent',
  closed: 'Closed',
}

export function isScopeKey(v: string | undefined): v is InboxScopeKey {
  return v === 'me' || v === 'company'
}

export function isFolderKey(v: string | undefined): v is InboxFolderKey {
  return v === 'inbox' || v === 'assigned' || v === 'drafts' || v === 'sent' || v === 'closed'
}

/** Legacy tab params (?scope=mine|assigned|drafts|unread|all|closed) → the FUB model. */
export function mapLegacyScope(
  v: string | undefined,
): { scope: InboxScopeKey; folder: InboxFolderKey; view: 'all' | 'unread' } | null {
  switch (v) {
    case 'mine':
      return { scope: 'me', folder: 'inbox', view: 'all' }
    case 'assigned':
      return { scope: 'me', folder: 'assigned', view: 'all' }
    case 'drafts':
      return { scope: 'me', folder: 'drafts', view: 'all' }
    case 'unread':
      return { scope: 'me', folder: 'inbox', view: 'unread' }
    case 'all':
      return { scope: 'company', folder: 'inbox', view: 'all' }
    case 'closed':
      return { scope: 'me', folder: 'closed', view: 'all' }
    default:
      return null
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * §26 mobile row timestamp (AC-26A-06 + AC-26C-02, server-rendered):
 *   "Xm" / "Xh" / "Xd" when ≤ 7 days · "Mon DD" same-year older · "M/DD/YY" prior years.
 * Pure (nowMs passed in) so it stays hydration-safe and unit-testable.
 */
export function mobileTimeLabel(ts: string | null, nowMs: number): string {
  if (!ts) return ''
  const then = new Date(ts)
  const diffMin = Math.floor((nowMs - then.getTime()) / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d <= 7) return `${d}d`
  const now = new Date(nowMs)
  if (then.getFullYear() === now.getFullYear()) return `${MONTHS[then.getMonth()]} ${then.getDate()}`
  return `${then.getMonth() + 1}/${String(then.getDate()).padStart(2, '0')}/${String(then.getFullYear() % 100).padStart(2, '0')}`
}

/** Server-rendered relative timestamp for thread rows (spec §4.1 — "16 hours ago"). */
export function relativeLabel(ts: string | null, nowMs: number): string {
  if (!ts) return ''
  const diffMin = Math.floor((nowMs - new Date(ts).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ${d === 1 ? 'day' : 'days'} ago`
  return formatDateTime(ts)
}

/** Assignable-broker options for the thread-list bulk-assign menu. */
export const BROKER_OPTIONS = CRM_BROKERS.map((slug) => ({
  slug,
  name: CRM_BROKER_DISPLAY[slug] ?? slug,
}))
