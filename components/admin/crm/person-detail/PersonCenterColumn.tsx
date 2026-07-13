'use client'

/**
 * PersonCenterColumn — §07b center column of the person-detail three-column
 * layout (spec docs/fub-crm-spec/07b-person-detail-timeline-and-engagement.md
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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { TimelineMediaStrip } from '@/components/admin/crm/StoredAttachments'
import { partitionNotes } from '@/lib/crm/note-classify'
import { addCrmNoteAction, startCrmCallAction } from '@/app/actions/crm'
import { logCrmCallAction, quickFollowUpAction, toggleTimelineStarAction } from '@/app/actions/crm-person-detail'

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
}

type ComposeMode = 'note' | 'email' | 'text' | 'call' | null

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

function kindIcon(kind: string, source: string): { icon: React.ReactNode; className: string } {
  if (kind.startsWith('email')) return { icon: <Mail className="h-3.5 w-3.5" />, className: 'bg-primary/10 text-primary' }
  if (kind.startsWith('text') || kind.startsWith('sms')) return { icon: <MessageSquare className="h-3.5 w-3.5" />, className: 'bg-secondary text-foreground' }
  if (kind === 'call' || kind === 'voicemail') return { icon: <Phone className="h-3.5 w-3.5" />, className: 'bg-success/15 text-success' }
  if (kind === 'note') return { icon: <StickyNote className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' }
  if (kind === 'web_event') return { icon: <Globe className="h-3.5 w-3.5" />, className: 'bg-warning/15 text-warning' }
  if (kind === 'lead_created') return { icon: <CircleAlert className="h-3.5 w-3.5" />, className: 'bg-warning/15 text-warning' }
  if (kind === 'task') return { icon: <ListChecks className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' }
  if (kind === 'stage_change' || kind === 'system') return { icon: <Settings className="h-3.5 w-3.5" />, className: 'bg-warning/15 text-warning' }
  void source
  return { icon: <Info className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' }
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

// ── Timeline event card (§07b 7) ─────────────────────────────────────────────

function EventCard({ item }: { item: TimelineItem }) {
  const now = useClientNow()
  const [expanded, setExpanded] = useState(false)
  const [starred, setStarred] = useState(item.starred)
  const [, start] = useTransition()
  const { icon, className } = kindIcon(item.kind, item.source)
  const isAutomationEmail = item.kind === 'email_out' && item.source === 'sequence'
  const isLeadOrigin = item.kind === 'lead_created'
  const preview = (item.body ?? '').trim()
  const long = preview.length > 220
  // Legacy Follow Up Boss texts/emails came in with their content redacted at
  // import (payload.contentHidden === true, body null). Show a labeled
  // placeholder instead of a confusingly blank card.
  const contentHidden = !preview && (item.payload as { contentHidden?: unknown } | null)?.contentHidden === true

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
      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', className)}>{icon}</div>
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{item.title ?? (isLeadOrigin ? 'Lead Origin' : item.kind.replace(/_/g, ' '))}</span>
            {isAutomationEmail ? (
              <Badge variant="secondary" className="ml-2 text-[10px] uppercase">
                Archived
              </Badge>
            ) : null}
            {typeof item.opens === 'number' && item.opens > 0 ? (
              <Badge className="ml-2 bg-success text-[10px] text-success-foreground">{item.opens} opens</Badge>
            ) : null}
            {typeof item.clicks === 'number' && item.clicks > 0 ? (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {item.clicks} clicks
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{cardTimestamp(item.ts, now)}</span>
            <button
              type="button"
              onClick={toggleStar}
              aria-label={starred ? 'Unstar' : 'Star'}
              className={cn('rounded p-0.5', starred ? 'text-warning' : 'text-muted-foreground opacity-0 group-hover:opacity-100')}
            >
              <Star className={cn('h-3.5 w-3.5', starred && 'fill-current')} />
            </button>
          </div>
        </div>

        {isLeadOrigin && payloadEntries.length > 0 ? (
          <dl className="mt-2 space-y-0.5">
            {payloadEntries.slice(0, 12).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                <dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                <dd className="truncate text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : preview ? (
          <button type="button" onClick={() => long && setExpanded((e) => !e)} className={cn('mt-1 block w-full text-left', long && 'cursor-pointer')}>
            <p className={cn('whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]', !expanded && 'line-clamp-2')}>{preview}</p>
            {long ? <span className="mt-0.5 text-xs font-medium text-primary">{expanded ? 'Show less' : 'Show more'}</span> : null}
          </button>
        ) : contentHidden ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs italic text-muted-foreground">
            <EyeOff className="h-3 w-3" aria-hidden />
            Content not synced from Follow Up Boss
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
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Add notes or type @name to notify" className="text-sm" />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          size="sm"
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
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="h-9 flex-1 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_OUTCOMES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" inputMode="numeric" placeholder="Minutes" className="h-9 w-28 text-sm" />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Call notes" className="text-sm" />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
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
          size="sm"
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
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-2">
          <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium text-foreground">{personName}</span>
          </Link>
        </div>

        {/* Action bar (§07b 4) */}
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setMode((m) => (m === a.key ? null : a.key))}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                mode === a.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Add Quick Follow Up" title="Add Quick Follow Up" className="h-8 w-8 text-primary">
                  <Zap className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {QUICK_FOLLOW_UPS.map((q) => (
                  <DropdownMenuItem
                    key={q.days}
                    disabled={quickPending}
                    onSelect={() =>
                      startQuick(async () => {
                        const r = await quickFollowUpAction(personId, q.days)
                        setQuickNote(r.ok ? `Follow-up task added: ${q.label}` : ('error' in r ? r.error : 'Could not add task'))
                        if (r.ok) router.refresh()
                      })
                    }
                  >
                    {q.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
              <Info className="h-3.5 w-3.5" /> How it works
            </span>
          </div>
        </div>

        {/* Compose panel */}
        {mode ? (
          <div className="border-t border-border bg-card px-4 py-3">
            {mode === 'note' ? <NoteCompose personId={personId} /> : null}
            {mode === 'email' ? emailComposer : null}
            {mode === 'text' ? (
              smsBlockedReason ? (
                <Alert>
                  <AlertTitle className="text-sm">Texting not available yet</AlertTitle>
                  <AlertDescription className="text-sm">{smsBlockedReason}</AlertDescription>
                </Alert>
              ) : (
                smsComposer
              )
            ) : null}
            {mode === 'call' ? <LogCallCompose personId={personId} /> : null}
          </div>
        ) : null}
        {quickNote ? <p className="px-4 pb-2 text-xs text-muted-foreground">{quickNote}</p> : null}

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
                  tab === t.key ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {count !== null && count > 0 ? (
                  <Badge variant="secondary" className="px-1.5 text-[10px] tabular-nums">
                    {count}
                  </Badge>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline (§07b 6) */}
      <div className="space-y-4 px-4 py-4">
        {tab === 'marketing' && (counts.marketing ?? 0) > 75 ? (
          <p className="text-xs text-muted-foreground">Showing 75 most recent marketing emails.</p>
        ) : null}
        {noteSplit ? (
          /* Notes tab: broker-written notes first, auto-generated below (§07b). */
          noteSplit.humanCount === 0 && noteSplit.systemCount === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <>
              {noteSplit.humanCount > 0 ? (
                noteSplit.humanGroups.map((g) => (
                  <div key={`h-${g.label}`} className="space-y-3">
                    <div className="relative text-center">
                      <span className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden />
                      <span className="relative bg-background px-3 text-xs font-medium text-muted-foreground">{g.label}</span>
                    </div>
                    {g.items.map((item) => (
                      <EventCard key={item.id} item={item} />
                    ))}
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No notes from your team yet.</p>
              )}

              {noteSplit.systemCount > 0 ? (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSystemNotes((v) => !v)}
                    aria-expanded={showSystemNotes}
                    className="flex w-full items-center gap-1.5 border-t border-border pt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showSystemNotes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Automated activity
                    <Badge variant="secondary" className="px-1.5 text-[10px] tabular-nums">
                      {noteSplit.systemCount}
                    </Badge>
                  </button>
                  {showSystemNotes
                    ? noteSplit.systemGroups.map((g) => (
                        <div key={`s-${g.label}`} className="space-y-3 opacity-70">
                          <div className="relative text-center">
                            <span className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden />
                            <span className="relative bg-background px-3 text-xs font-medium text-muted-foreground">{g.label}</span>
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
          <p className="py-8 text-center text-sm text-muted-foreground">No activity in this view yet.</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-3">
              <div className="relative text-center">
                <span className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden />
                <span className="relative bg-background px-3 text-xs font-medium text-muted-foreground">{g.label}</span>
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
            size="sm"
            variant="secondary"
            className="rounded-full shadow-md"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp className="mr-1 h-3.5 w-3.5" /> Scroll to top
          </Button>
        </div>
      ) : null}
    </div>
  )
}
