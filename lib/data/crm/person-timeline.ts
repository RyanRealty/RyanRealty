/**
 * Pure merge for the person-page v3 timeline.
 *
 * Conversation, activity feed, notes, page views, and email engagement all
 * describe overlapping events today (a sent text is in the thread AND the
 * feed). This union is newest-first, one row per event.
 */
import type { ConversationMessage } from '@/lib/data/crm/getContactConversation'
import type { ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'
import type { PersonNoteRow } from '@/lib/data/crm/getPersonNotes'
import type { ContactEmailSend } from '@/lib/data/crm/getContactEmailEngagement'
import { isEmailLifecycleKind } from '@/lib/crm/email-lifecycle-kinds'

export type PersonTimelineChannel =
  | 'sms'
  | 'email'
  | 'call'
  | 'visit'
  | 'note'
  | 'system'
  | 'milestone'

export type PersonTimelineItem = {
  id: string
  ts: string
  channel: PersonTimelineChannel
  direction: 'in' | 'out' | null
  actor: string | null
  title: string
  body: string | null
  href: string | null
  system: boolean
  /** What happened to an email we sent (delivered, bounced, spam, unsubscribed).
   *  Shown, but never the contact's last activity (lib/crm/email-lifecycle-kinds.ts). */
  lifecycle?: boolean
}

export type PersonTimelinePageView = {
  ts: string
  title: string
  href?: string | null
}

/** Flatten identity-loop visits into timeline visit rows. */
export function pageViewsFromVisits(
  visits: Array<{ pages: Array<{ at: string; title: string; path: string }> }>,
): PersonTimelinePageView[] {
  return visits.flatMap((visit) =>
    visit.pages.map((page) => ({
      ts: page.at,
      title: page.title,
      href: page.path,
    })),
  )
}

export function conversationHasInboundSms(items: Array<{ kind: string }>): boolean {
  return items.some((item) => item.kind === 'sms_in')
}

function tsMs(iso: string): number {
  const n = new Date(iso).getTime()
  return Number.isFinite(n) ? n : 0
}

function snippet(text: string | null | undefined, max = 400): string | null {
  const raw = (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  return raw.length > max ? `${raw.slice(0, max)}…` : raw
}

function kindChannel(kind: string): PersonTimelineChannel {
  if (kind.startsWith('sms')) return 'sms'
  if (kind.startsWith('email')) return 'email'
  if (kind === 'call' || kind === 'voicemail') return 'call'
  if (kind === 'note') return 'note'
  if (kind === 'web_event' || kind === 'parsed_intent') return 'visit'
  if (kind === 'system') return 'system'
  return 'milestone'
}

function kindDirection(kind: string): 'in' | 'out' | null {
  if (kind.endsWith('_in') || kind === 'voicemail' || kind === 'email_open' || kind === 'email_click') {
    return 'in'
  }
  if (kind.endsWith('_out')) return 'out'
  return null
}

function dedupeKey(item: Pick<PersonTimelineItem, 'ts' | 'channel' | 'direction' | 'body' | 'title'>): string {
  const body = (item.body ?? '').slice(0, 80).toLowerCase()
  return [item.ts, item.channel, item.direction ?? '', body || item.title.toLowerCase()].join('|')
}

export function mergePersonTimeline(input: {
  conversation?: ConversationMessage[]
  feed?: ActivityFeedItem[]
  notes?: PersonNoteRow[]
  pageViews?: PersonTimelinePageView[]
  emailSends?: ContactEmailSend[]
}): PersonTimelineItem[] {
  const items: PersonTimelineItem[] = []

  for (const m of input.conversation ?? []) {
    const channel = kindChannel(m.kind)
    items.push({
      id: `conv:${m.id}`,
      ts: m.ts,
      channel,
      direction: kindDirection(m.kind),
      actor: m.broker,
      title: m.title?.trim() || labelForKind(m.kind),
      body: snippet(m.body ?? m.title),
      href: null,
      system: channel === 'system',
    })
  }

  for (const n of input.notes ?? []) {
    items.push({
      id: `note:${n.id}`,
      ts: n.ts,
      channel: 'note',
      direction: null,
      actor: n.broker,
      title: n.broker ? `Note · ${n.broker}` : 'Note',
      body: snippet(n.body),
      href: null,
      system: false,
    })
  }

  for (const v of input.pageViews ?? []) {
    items.push({
      id: `visit:${v.ts}:${v.title}`,
      ts: v.ts,
      channel: 'visit',
      direction: 'in',
      actor: null,
      title: v.title,
      body: null,
      href: v.href ?? null,
      system: false,
    })
  }

  for (const s of input.emailSends ?? []) {
    if (!s.sentAt) continue
    items.push({
      id: `email:${s.key}`,
      ts: s.sentAt,
      channel: 'email',
      direction: 'out',
      actor: null,
      title: s.subject?.trim() || 'Email sent',
      body: snippet(s.subject),
      href: null,
      system: false,
    })
  }

  for (const f of input.feed ?? []) {
    const channel = kindChannel(f.kind)
    items.push({
      id: `feed:${f.id}`,
      ts: f.ts,
      channel,
      direction: f.direction,
      actor: f.broker,
      title: f.label,
      body: snippet(f.snippet),
      href: null,
      system: f.category === 'system',
      ...(isEmailLifecycleKind(f.kind) ? { lifecycle: true } : {}),
    })
  }

  const seen = new Set<string>()
  const unique: PersonTimelineItem[] = []
  for (const item of items) {
    const key = dedupeKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  unique.sort((a, b) => {
    const delta = tsMs(b.ts) - tsMs(a.ts)
    if (delta !== 0) return delta
    return a.id.localeCompare(b.id)
  })
  return unique
}

function labelForKind(kind: string): string {
  if (kind === 'sms_out') return 'Text sent'
  if (kind === 'sms_in') return 'Text received'
  if (kind === 'email_out') return 'Email sent'
  if (kind === 'email_in') return 'Email received'
  if (kind === 'call') return 'Call'
  if (kind === 'voicemail') return 'Voicemail'
  if (kind === 'note') return 'Note'
  return kind.replace(/[_-]+/g, ' ')
}

export function filterPersonTimeline(
  items: PersonTimelineItem[],
  filter: 'all' | PersonTimelineChannel,
  opts: { showSystem?: boolean } = {},
): PersonTimelineItem[] {
  return items.filter((item) => {
    if (!opts.showSystem && item.system) return false
    if (filter === 'all') return true
    return item.channel === filter
  })
}
