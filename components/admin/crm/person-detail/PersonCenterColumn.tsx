'use client'

/**
 * PersonCenterColumn — §07b center column of the person-detail three-column
 * layout (spec docs/crm-spec/07b-person-detail-timeline-and-engagement.md
 * + 07c §7c.1–7c.5 compose modes).
 *
 * Top to bottom: person navigation strip (§3) → action bar with the four
 * co-equal compose tabs + "How it works" + ⚡ Quick Follow Up (§4) → the active
 * compose panel (Create Note / Send Email / Text / Log Call) → the 8 timeline
 * filter tabs (§5) → reverse-chronological event cards with date separators,
 * star toggles, Archived pills, opens badges, and the LEAD ORIGIN card (§6–§8)
 * → "Scroll to top" FAB (§8.4).
 *
 * Email/SMS composers are passed in as slots (they carry bound server actions
 * from the server page). Counts come from getPersonDetailExtras (exact,
 * count:'exact' — never rows.length).
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action, filter and
 * user-visible string is unchanged. Five notes on the swap:
 *  - The four compose tabs are v2 Buttons (primary when active, quiet
 *    otherwise). The barrel carries their hover, pressed and focus states, so
 *    nothing is hand-rolled; they lose the pill radius the old chips had.
 *  - The Quick Follow Up dropdown is the barrel's Menu, which owns
 *    click-outside, Escape, focus return and arrow-key roving.
 *  - Timeline chips are plain token-styled spans, not StateWord: .av2-state
 *    uppercases, and "3 opens" / "Group · 4 people" / a delivery receipt read
 *    as sentence-case facts.
 *  - The timeline filter row and the compose textareas stay raw controls
 *    carrying token classes. A full-width underline tab and an unlabelled
 *    composer are neither a centred Button nor a labelled TextAreaField —
 *    same call, same reason, as MobileNotesTab in components/admin/shared.
 *  - One primary Button per compose PANEL. The panels are mutually exclusive
 *    views, and demoting the commit action in one of them would leave that
 *    panel with no primary action.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  StickyNote,
  Mail,
  MessageSquare,
  Phone,
  Zap,
  Star,
  Info,
  Globe,
  Settings,
  ListChecks,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Check,
  CheckCheck,
  Clock3,
  TriangleAlert,
  RefreshCw,
  Users,
} from 'lucide-react'
import { groupInfoFromPayload } from '@/lib/crm/group-message'
import { Button, IconButton, Menu, SearchField, ToolbarSelect } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { TimelineMediaStrip } from '@/components/admin/crm/StoredAttachments'
import { partitionNotes } from '@/lib/crm/note-classify'
import { timelineArtifactDoor } from '@/lib/crm/timeline-artifacts'
import { addCrmNoteAction, startCrmCallAction } from '@/app/actions/crm'
import { logCrmCallAction, quickFollowUpAction, toggleTimelineStarAction, refreshSmsDeliveryStatusAction } from '@/app/actions/crm-person-detail'

export type TimelineItem = {
  id: number
  kind: string
  ts: string
  title: string | null
  body: string | null
  broker: string | null
  source: string
  starred: boolean
  payload: Record<string, unknown>
  opens?: number
  clicks?: number
  delivered?: boolean
  bounced?: boolean
  visitedAfterSend?: boolean
  campaignHref?: string | null
}

type ComposeMode = 'note' | 'email' | 'text' | 'call' | null

const MUTED: React.CSSProperties = { color: 'var(--a-text-2)' }
const DANGER: React.CSSProperties = { color: 'var(--a-danger)' }

/** Small sentence-case chip. See the header note on StateWord. */
function TimelineChip({
  tone = 'neutral',
  className,
  title,
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const TONES: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'var(--a-inset)', fg: 'var(--a-text-2)' },
    ok: { bg: 'var(--a-ok-wash)', fg: 'var(--a-ok)' },
    warn: { bg: 'var(--a-warn-wash)', fg: 'var(--a-warn)' },
    danger: { bg: 'var(--a-danger-wash)', fg: 'var(--a-danger)' },
    accent: { bg: 'var(--a-accent-wash)', fg: 'var(--a-accent)' },
  }
  const t = TONES[tone]
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', className)}
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  )
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'emails', label: 'Emails' },
  { key: 'texts', label: 'Texts' },
  { key: 'calls', label: 'Calls' },
  { key: 'notes', label: 'Notes' },
  { key: 'activity', label: 'Activity' },
  { key: 'marketing', label: 'Marketing Emails' },
  { key: 'starred', label: 'Starred Items' },
] as const

const TAB_KINDS: Record<string, string[]> = {
  emails: ['email_in', 'email_out'],
  texts: ['text_in', 'text_out', 'sms_in', 'sms_out'],
  calls: ['call', 'voicemail'],
  notes: ['note'],
  activity: ['web_event', 'stage_change', 'system', 'lead_created', 'task'],
}

const QUICK_FOLLOW_UPS: Array<{ label: string; days: number }> = [
  { label: '1 Day', days: 1 },
  { label: '3 Day', days: 3 },
  { label: '1 Week', days: 7 },
  { label: '2 Week', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Month', days: 90 },
  { label: '6 Month', days: 180 },
  { label: '12 Month', days: 365 },
]

const CALL_OUTCOMES = ['Spoke with lead', 'Left voicemail', 'No answer', 'Wrong number', 'Do not contact', 'Other']

/** Kind glyph + its token pair. Colour is status vocabulary, never decoration. */
function kindIcon(kind: string, source: string): { icon: React.ReactNode; style: React.CSSProperties } {
  const tint = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg })
  const NEUTRAL = tint('var(--a-inset)', 'var(--a-text-2)')
  const WARN = tint('var(--a-warn-wash)', 'var(--a-warn)')
  if (kind.startsWith('email')) return { icon: <Mail className="h-3.5 w-3.5" />, style: tint('var(--a-accent-wash)', 'var(--a-accent)') }
  if (kind.startsWith('text') || kind.startsWith('sms')) return { icon: <MessageSquare className="h-3.5 w-3.5" />, style: tint('var(--a-inset)', 'var(--a-text)') }
  if (kind === 'call' || kind === 'voicemail') return { icon: <Phone className="h-3.5 w-3.5" />, style: tint('var(--a-ok-wash)', 'var(--a-ok)') }
  if (kind === 'note') return { icon: <StickyNote className="h-3.5 w-3.5" />, style: NEUTRAL }
  if (kind === 'web_event') return { icon: <Globe className="h-3.5 w-3.5" />, style: WARN }
  if (kind === 'lead_created') return { icon: <CircleAlert className="h-3.5 w-3.5" />, style: WARN }
  if (kind === 'task') return { icon: <ListChecks className="h-3.5 w-3.5" />, style: NEUTRAL }
  if (kind === 'stage_change' || kind === 'system') return { icon: <Settings className="h-3.5 w-3.5" />, style: WARN }
  void source
  return { icon: <Info className="h-3.5 w-3.5" />, style: NEUTRAL }
}

function dateGroupLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
}

/** Bucket an already-sorted (newest-first) timeline list into date sections. */
function dateGroupItems(list: TimelineItem[]): Array<{ label: string; items: TimelineItem[] }> {
  const out: Array<{ label: string; items: TimelineItem[] }> = []
  for (const item of list) {
    const label = dateGroupLabel(item.ts)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(item)
    else out.push({ label, items: [item] })
  }
  return out
}

/**
 * Client-only clock read (hydration-safe per gate #418): null on the server and
 * the first client render, the real time after mount.
 */
function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  return now
}

function cardTimestamp(iso: string, now: Date | null): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  // Pre-hydration: a deterministic absolute date (no clock read in render).
  if (now == null) {
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })} · ${time}`
  }
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `Today · ${time}`
  const yesterday = new Date(now.getTime() - 86400_000)
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`
  const days = (now.getTime() - d.getTime()) / 86400_000
  if (days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' })} · ${time}`
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'America/Los_Angeles' })
}

// ── SMS delivery status (§9.4) ───────────────────────────────────────────────

type SmsDelivery = {
  state: string | null
  errorCode: number | null
  carrierFiltered: boolean
  hasSid: boolean
}

/** Read the delivery fields the Twilio status webhook writes onto an sms_out payload. */
function readSmsDelivery(payload: Record<string, unknown> | null): SmsDelivery {
  const p = payload ?? {}
  return {
    state: typeof p.deliveryState === 'string' ? p.deliveryState : null,
    errorCode: typeof p.errorCode === 'number' ? p.errorCode : null,
    carrierFiltered: p.carrierFiltered === true,
    hasSid: typeof p.twilioSid === 'string' && p.twilioSid.length > 0,
  }
}

const DELIVERY_TERMINAL = new Set(['delivered', 'undelivered', 'failed'])

/**
 * Delivery-receipt badge for an outbound text. Renders the state the Twilio
 * StatusCallback webhook recorded onto the row. When a text is still pending (no
 * receipt yet, or stuck in `queued`), a refresh control reconciles it against
 * Twilio's live status on demand — the message-stuck-in-queued case that has no
 * webhook callback to rely on. Imported legacy texts (no Twilio SID) show nothing.
 */
function SmsDeliveryBadge({ item }: { item: TimelineItem }) {
  const initial = readSmsDelivery(item.payload)
  const [state, setState] = useState<string | null>(initial.state)
  const [errorCode, setErrorCode] = useState<number | null>(initial.errorCode)
  const [carrierFiltered, setCarrierFiltered] = useState<boolean>(initial.carrierFiltered)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  // Legacy/imported texts have no delivery telemetry — don't imply one.
  if (!initial.hasSid) return null

  const terminal = state != null && DELIVERY_TERMINAL.has(state)
  const isFailure = carrierFiltered || state === 'undelivered' || state === 'failed'

  let label: string
  let variant: 'delivered' | 'sent' | 'pending' | 'failed'
  let Icon = Clock3
  if (carrierFiltered) {
    label = `Carrier blocked${errorCode ? ` (${errorCode})` : ''}`
    variant = 'failed'
    Icon = TriangleAlert
  } else if (state === 'delivered') {
    label = 'Delivered'
    variant = 'delivered'
    Icon = CheckCheck
  } else if (state === 'undelivered' || state === 'failed') {
    label = `${state === 'failed' ? 'Failed' : 'Undelivered'}${errorCode ? ` (${errorCode})` : ''}`
    variant = 'failed'
    Icon = TriangleAlert
  } else if (state === 'sent') {
    label = 'Sent'
    variant = 'sent'
    Icon = Check
  } else if (state === 'queued' || state === 'sending') {
    label = state === 'sending' ? 'Sending' : 'Queued'
    variant = 'pending'
    Icon = Clock3
  } else {
    // Has a Twilio SID but no recorded receipt yet — accepted, awaiting delivery.
    label = 'Pending'
    variant = 'pending'
    Icon = Clock3
  }

  const tones: Record<typeof variant, 'ok' | 'neutral' | 'warn' | 'danger'> = {
    delivered: 'ok',
    sent: 'neutral',
    pending: 'warn',
    failed: 'danger',
  }

  function refresh() {
    setErr(null)
    start(async () => {
      const r = await refreshSmsDeliveryStatusAction(item.id)
      if (r.ok) {
        setState(r.state)
        setErrorCode(r.errorCode)
        setCarrierFiltered(r.carrierFiltered)
      } else {
        setErr(r.error)
      }
    })
  }

  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle">
      <TimelineChip tone={tones[variant]} title={err ?? undefined}>
        <Icon className={cn('h-3 w-3', pending && 'animate-spin')} aria-hidden />
        {label}
      </TimelineChip>
      {/* Reconcile the pending / non-terminal case against Twilio live. Terminal
          delivered/undelivered/failed states are final — no refresh needed. */}
      {!terminal || isFailure ? (
        <IconButton
          label="Refresh delivery status"
          onClick={refresh}
          disabled={pending}
          style={{ width: 20, height: 20 }}
        >
          <RefreshCw className={cn('h-3 w-3', pending && 'animate-spin')} />
        </IconButton>
      ) : null}
    </span>
  )
}

// ── Timeline event card (§07b 7) ─────────────────────────────────────────────

function EventCard({ item }: { item: TimelineItem }) {
  const now = useClientNow()
  const [expanded, setExpanded] = useState(false)
  const [starred, setStarred] = useState(item.starred)
  const [, start] = useTransition()
  const { icon, style: kindStyle } = kindIcon(item.kind, item.source)
  const isAutomationEmail = item.kind === 'email_out' && item.source === 'sequence'
  const isLeadOrigin = item.kind === 'lead_created'
  const preview = (item.body ?? '').trim()
  const long = preview.length > 220
  // Legacy imported texts/emails came in with their content redacted at
  // import (payload.contentHidden === true, body null). Show a labeled
  // placeholder instead of a confusingly blank card.
  const contentHidden = !preview && (item.payload as { contentHidden?: unknown } | null)?.contentHidden === true
  // Group text detection (RC1): a group message is written with payload.groupTo /
  // groupMembers. Surfacing it here is what makes a group text unmistakable from a
  // private 1:1 — previously they rendered identically.
  const group = groupInfoFromPayload(item.payload)

  function toggleStar() {
    const next = !starred
    setStarred(next)
    start(async () => {
      const r = await toggleTimelineStarAction(item.id, next)
      if (!r.ok) setStarred(!next)
    })
  }

  const payloadEntries = isLeadOrigin
    ? Object.entries(item.payload ?? {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    : []

  return (
    <div className="group flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={kindStyle}
      >
        {icon}
      </div>
      <div
        className="min-w-0 flex-1 rounded-lg px-3 py-2.5"
        style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>
              {item.title ?? (isLeadOrigin ? 'Lead Origin' : item.kind.replace(/_/g, ' '))}
            </span>
            {isAutomationEmail ? (
              <TimelineChip className="ml-2 uppercase">Archived</TimelineChip>
            ) : null}
            {item.bounced ? (
              <TimelineChip tone="danger" className="ml-2">
                Bounced
              </TimelineChip>
            ) : item.delivered ? (
              <TimelineChip className="ml-2">Delivered</TimelineChip>
            ) : null}
            {typeof item.opens === 'number' && item.opens > 0 ? (
              <TimelineChip tone="ok" className="ml-2">
                {item.opens} opens
              </TimelineChip>
            ) : null}
            {typeof item.clicks === 'number' && item.clicks > 0 ? (
              <TimelineChip className="ml-1">{item.clicks} clicks</TimelineChip>
            ) : null}
            {item.visitedAfterSend ? (
              <TimelineChip tone="ok" className="ml-1">
                On the site after
              </TimelineChip>
            ) : null}
            {item.campaignHref ? (
              <Link href={item.campaignHref} className="ml-2 text-xs" style={{ color: 'var(--a-accent)' }}>
                Batch send
              </Link>
            ) : null}
            {(() => {
              const door = timelineArtifactDoor(item.payload, item.body)
              return door ? (
                <Link href={door.href} className="ml-2 text-xs" style={{ color: 'var(--a-accent)' }}>
                  {door.label}
                </Link>
              ) : null
            })()}
            {item.kind === 'sms_out' ? <SmsDeliveryBadge item={item} /> : null}
            {group ? (
              <TimelineChip className="ml-2" title={`Group text · ${group.participants.join(', ')}`}>
                <Users className="h-3 w-3" aria-hidden />
                Group · {group.count} people
              </TimelineChip>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs tabular-nums" style={MUTED}>
              {cardTimestamp(item.ts, now)}
            </span>
            {item.id > 0 ? (
              <IconButton
                label={starred ? 'Unstar' : 'Star'}
                onClick={toggleStar}
                className={cn(!starred && 'opacity-0 group-hover:opacity-100')}
                style={{ width: 22, height: 22, color: starred ? 'var(--a-warn)' : undefined }}
              >
                <Star className={cn('h-3.5 w-3.5', starred && 'fill-current')} />
              </IconButton>
            ) : null}
          </div>
        </div>

        {isLeadOrigin && payloadEntries.length > 0 ? (
          <dl className="mt-2 space-y-0.5">
            {payloadEntries.slice(0, 12).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                <dt style={MUTED}>{k.replace(/_/g, ' ')}</dt>
                <dd className="truncate" style={{ color: 'var(--a-text)' }}>
                  {String(v)}
                </dd>
              </div>
            ))}
          </dl>
        ) : preview ? (
          <button type="button" onClick={() => long && setExpanded((e) => !e)} className={cn('mt-1 block w-full text-left', long && 'cursor-pointer')}>
            <p
              className={cn('whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]', !expanded && 'line-clamp-2')}
              style={MUTED}
            >
              {preview}
            </p>
            {long ? (
              <span className="mt-0.5 text-xs font-medium" style={{ color: 'var(--a-accent)' }}>
                {expanded ? 'Show less' : 'Show more'}
              </span>
            ) : null}
          </button>
        ) : contentHidden ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs italic" style={MUTED}>
            <EyeOff className="h-3 w-3" aria-hidden />
            Content not imported
          </p>
        ) : null}
        {/* MMS media + stored outbound attachments (sent email files / MMS). */}
        <TimelineMediaStrip payload={item.payload} />
      </div>
    </div>
  )
}

// ── Compose panels ───────────────────────────────────────────────────────────

function NoteCompose({ personId }: { personId: number }) {
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  return (
    <div className="space-y-2">
      {/* Placeholder-only by contract: TextAreaField prints a visible label this
          composer never had. Raw control + av2-input + aria-label is the
          folder's pattern for an unlabelled field. */}
      <textarea
        className="av2-input w-full"
        aria-label="Note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add notes or type @name to notify"
      />
      {error ? (
        <p className="text-xs" style={DANGER}>
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={!body.trim() || pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData()
              fd.set('personId', String(personId))
              fd.set('body', body)
              const r = await addCrmNoteAction(fd)
              if (r.ok) {
                setBody('')
                setError(null)
                router.refresh()
              } else setError(r.error ?? 'Note not saved.')
            })
          }
        >
          Create Note
        </Button>
      </div>
    </div>
  )
}

function LogCallCompose({ personId }: { personId: number }) {
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0])
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ToolbarSelect
          aria-label="Call outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="flex-1"
          style={{ maxWidth: 'none' }}
        >
          {CALL_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </ToolbarSelect>
        <SearchField
          aria-label="Minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder="Minutes"
          className="w-28"
          style={{ maxWidth: 'none' }}
        />
      </div>
      <textarea
        className="av2-input w-full"
        aria-label="Call notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Call notes"
      />
      {error ? (
        <p className="text-xs" style={DANGER}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData()
              fd.set('personId', String(personId))
              const r = await startCrmCallAction(fd)
              setError(r.ok ? 'Calling now. Your phone rings first, then connects to the lead (recorded).' : r.error ?? 'Call not started.')
            })
          }
        >
          <Phone className="mr-1 h-3.5 w-3.5" /> Call now
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData()
              fd.set('personId', String(personId))
              fd.set('outcome', outcome)
              fd.set('minutes', minutes)
              fd.set('notes', notes)
              const r = await logCrmCallAction(fd)
              if (r.ok) {
                setNotes('')
                setMinutes('')
                router.refresh()
              } else setError(r.error)
            })
          }
        >
          Log Call
        </Button>
      </div>
    </div>
  )
}

// ── The center column ────────────────────────────────────────────────────────

export function PersonCenterColumn({
  personId,
  personName,
  backHref,
  items,
  counts,
  totalCount,
  starredCount,
  emailComposer,
  smsComposer,
  smsBlockedReason,
}: {
  personId: number
  personName: string
  backHref: string
  items: TimelineItem[]
  counts: Record<string, number>
  totalCount: number
  starredCount: number
  emailComposer: React.ReactNode
  smsComposer: React.ReactNode
  /** When set, the Text tab shows this provisioning/compliance banner instead of the composer (§7c.4.3). */
  smsBlockedReason: string | null
}) {
  const [mode, setMode] = useState<ComposeMode>(null)
  const [tab, setTab] = useState<string>('all')
  const [showFab, setShowFab] = useState(false)
  const [quickPending, startQuick] = useTransition()
  const [quickNote, setQuickNote] = useState<string | null>(null)
  // Notes tab: the "Automated activity" (system-note) section is collapsed by
  // default so a broker's own notes sit above the automation firehose.
  const [showSystemNotes, setShowSystemNotes] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const filtered = useMemo(() => {
    if (tab === 'all') return items
    if (tab === 'starred') return items.filter((i) => i.starred)
    if (tab === 'marketing') return items.filter((i) => i.kind === 'email_out' && i.source === 'sequence').slice(0, 75)
    const kinds = TAB_KINDS[tab] ?? []
    return items.filter((i) => kinds.includes(i.kind))
  }, [items, tab])

  const groups = useMemo(() => dateGroupItems(filtered), [filtered])

  // Notes tab only: split broker-written notes (shown first) from
  // auto-generated system notes (de-emphasized below). Display-only ranking —
  // both groups keep the reverse-chron order from `filtered`; nothing is hidden.
  const noteSplit = useMemo(() => {
    if (tab !== 'notes') return null
    const { human, system } = partitionNotes(filtered)
    return {
      humanGroups: dateGroupItems(human),
      systemGroups: dateGroupItems(system),
      humanCount: human.length,
      systemCount: system.length,
    }
  }, [tab, filtered])

  const tabCount = (key: string): number | null => {
    if (key === 'all') return totalCount
    if (key === 'starred') return starredCount
    if (key === 'marketing') return counts.marketing ?? 0
    return counts[key] ?? 0
  }

  const ACTIONS: Array<{ key: Exclude<ComposeMode, null>; label: string; icon: React.ReactNode }> = [
    { key: 'note', label: 'Create Note', icon: <StickyNote className="h-4 w-4" /> },
    { key: 'email', label: 'Send Email', icon: <Mail className="h-4 w-4" /> },
    { key: 'text', label: 'Text', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'call', label: 'Log Call', icon: <Phone className="h-4 w-4" /> },
  ]

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setShowFab((e.target as HTMLDivElement).scrollTop > 300)}
      className="relative h-full overflow-y-auto"
    >
      {/* Person navigation strip (§07b 3) — counter hidden (direct-URL arrival) */}
      <div
        className="sticky top-0 z-10 backdrop-blur"
        style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-bg)' }}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-[color:var(--a-text-2)] hover:text-[color:var(--a-text)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium" style={{ color: 'var(--a-text)' }}>
              {personName}
            </span>
          </Link>
        </div>

        {/* Action bar (§07b 4) */}
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {ACTIONS.map((a) => (
            <Button
              key={a.key}
              variant={mode === a.key ? 'primary' : 'quiet'}
              onClick={() => setMode((m) => (m === a.key ? null : a.key))}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Menu
              label="Add Quick Follow Up"
              align="end"
              trigger={<Zap className="h-4 w-4" />}
              items={QUICK_FOLLOW_UPS.map((q) => ({
                label: q.label,
                disabled: quickPending,
                onSelect: () =>
                  startQuick(async () => {
                    const r = await quickFollowUpAction(personId, q.days)
                    setQuickNote(r.ok ? `Follow-up task added: ${q.label}` : ('error' in r ? r.error : 'Could not add task'))
                    if (r.ok) router.refresh()
                  }),
              }))}
            />
            <span className="hidden items-center gap-1 text-xs lg:flex" style={MUTED}>
              <Info className="h-3.5 w-3.5" /> How it works
            </span>
          </div>
        </div>

        {/* Compose panel */}
        {mode ? (
          <div
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
          >
            {mode === 'note' ? <NoteCompose personId={personId} /> : null}
            {mode === 'email' ? emailComposer : null}
            {mode === 'text' ? (
              smsBlockedReason ? (
                <div
                  role="alert"
                  className="rounded-lg px-4 py-3"
                  style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
                    Texting not available yet
                  </p>
                  <p className="text-sm" style={MUTED}>
                    {smsBlockedReason}
                  </p>
                </div>
              ) : (
                smsComposer
              )
            ) : null}
            {mode === 'call' ? <LogCallCompose personId={personId} /> : null}
          </div>
        ) : null}
        {quickNote ? (
          <p className="px-4 pb-2 text-xs" style={MUTED}>
            {quickNote}
          </p>
        ) : null}

        {/* Filter tabs (§07b 5) */}
        <div className="flex gap-0.5 overflow-x-auto px-4">
          {TABS.map((t) => {
            const count = tabCount(t.key)
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm',
                  tab === t.key
                    ? 'border-b-[color:var(--a-accent)] font-semibold text-[color:var(--a-text)]'
                    : 'border-b-transparent text-[color:var(--a-text-2)] hover:text-[color:var(--a-text)]',
                )}
              >
                {t.label}
                {count !== null && count > 0 ? (
                  <TimelineChip className="tabular-nums">{count}</TimelineChip>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline (§07b 6) */}
      <div className="space-y-4 px-4 py-4">
        {tab === 'marketing' && (counts.marketing ?? 0) > 75 ? (
          <p className="text-xs" style={MUTED}>
            Showing 75 most recent marketing emails.
          </p>
        ) : null}
        {noteSplit ? (
          /* Notes tab: broker-written notes first, auto-generated below (§07b). */
          noteSplit.humanCount === 0 && noteSplit.systemCount === 0 ? (
            <p className="py-8 text-center text-sm" style={MUTED}>
              No notes yet.
            </p>
          ) : (
            <>
              {noteSplit.humanCount > 0 ? (
                noteSplit.humanGroups.map((g) => (
                  <div key={`h-${g.label}`} className="space-y-3">
                    <div className="relative text-center">
                      <span
                        className="absolute inset-x-0 top-1/2"
                        style={{ borderTop: '1px solid var(--a-border)' }}
                        aria-hidden
                      />
                      <span
                        className="relative px-3 text-xs font-medium"
                        style={{ background: 'var(--a-bg)', color: 'var(--a-text-2)' }}
                      >
                        {g.label}
                      </span>
                    </div>
                    {g.items.map((item) => (
                      <EventCard key={item.id} item={item} />
                    ))}
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm" style={MUTED}>
                  No notes from your team yet.
                </p>
              )}

              {noteSplit.systemCount > 0 ? (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSystemNotes((v) => !v)}
                    aria-expanded={showSystemNotes}
                    className="flex w-full items-center gap-1.5 pt-3 text-xs font-medium text-[color:var(--a-text-2)] hover:text-[color:var(--a-text)]"
                    style={{ borderTop: '1px solid var(--a-border)' }}
                  >
                    {showSystemNotes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Automated activity
                    <TimelineChip className="tabular-nums">{noteSplit.systemCount}</TimelineChip>
                  </button>
                  {showSystemNotes
                    ? noteSplit.systemGroups.map((g) => (
                        <div key={`s-${g.label}`} className="space-y-3 opacity-70">
                          <div className="relative text-center">
                            <span
                              className="absolute inset-x-0 top-1/2"
                              style={{ borderTop: '1px solid var(--a-border)' }}
                              aria-hidden
                            />
                            <span
                              className="relative px-3 text-xs font-medium"
                              style={{ background: 'var(--a-bg)', color: 'var(--a-text-2)' }}
                            >
                              {g.label}
                            </span>
                          </div>
                          {g.items.map((item) => (
                            <EventCard key={item.id} item={item} />
                          ))}
                        </div>
                      ))
                    : null}
                </div>
              ) : null}
            </>
          )
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm" style={MUTED}>
            No activity in this view yet.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-3">
              <div className="relative text-center">
                <span
                  className="absolute inset-x-0 top-1/2"
                  style={{ borderTop: '1px solid var(--a-border)' }}
                  aria-hidden
                />
                <span
                  className="relative px-3 text-xs font-medium"
                  style={{ background: 'var(--a-bg)', color: 'var(--a-text-2)' }}
                >
                  {g.label}
                </span>
              </div>
              {g.items.map((item) => (
                <EventCard key={item.id} item={item} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Scroll-to-top FAB (§07b 8.4) */}
      {showFab ? (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            variant="quiet"
            // Radius and shadow are inline because .av2-btn declares its own
            // radius UNLAYERED; the hover/pressed states live on background and
            // transform, so nothing here overrides them.
            style={{ borderRadius: 999, boxShadow: 'var(--a-shadow-overlay)' }}
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp className="mr-1 h-3.5 w-3.5" /> Scroll to top
          </Button>
        </div>
      ) : null}
    </div>
  )
}
