'use client'

/**
 * FUB-clone Comms feed for a CRM person. Renders the contact's messages as a
 * chronological row list — one row per message, newest first — matching the
 * Comms tab (channel icon · subject/descriptor · participant ·
 * 2-line preview · date · email open-count). Rows collapse to the FUB anatomy at
 * rest and expand on tap to reveal the full body, MMS attachments, and call
 * recordings (features FUB's collapsed rows don't carry, surfaced on demand).
 */
import { useState, useTransition } from 'react'
import { EyeOff, Mail, MailOpen, MessageSquare, Phone, ShieldAlert, Users, Voicemail } from 'lucide-react'
import { groupInfoFromPayload } from '@/lib/crm/group-message'
import { Button } from '@/components/admin/v2'
import { blockCrmNumber } from '@/app/actions/crm-block'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { StoredAttachmentStrip } from '@/components/admin/crm/StoredAttachments'
import { formatDate, formatDateTime as fmtDateTimeFn } from '@/lib/format/date'

export type ConversationEvent = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  broker: string | null
  payload?: Record<string, unknown> | null
}

export type EmailEngagement = { opens: number; lastOpen: string | null; clicks: number }

const RECORDING_SID_RE = /^RE[a-f0-9]{32}$/
function recordingSidOf(payload: ConversationEvent['payload']): string | null {
  const sid = payload && typeof payload.recordingSid === 'string' ? payload.recordingSid : null
  return sid && RECORDING_SID_RE.test(sid) ? sid : null
}

/** Inbound MMS attachments on a message, resolved to admin proxy URLs. */
function mediaOf(payload: ConversationEvent['payload']): Array<{ messageSid: string; mediaSid: string; contentType: string }> {
  if (!payload) return []
  const sid = typeof payload.sid === 'string' ? payload.sid : typeof payload.messageSid === 'string' ? payload.messageSid : ''
  // MM/SM = classic MMS; IM = Conversations group-text media (same proxy route).
  if (!/^(MM|SM|IM)[a-f0-9]{32}$/.test(sid)) return []
  const arr = Array.isArray(payload.media) ? payload.media : []
  return arr.flatMap((m) => {
    const mm = m as { mediaSid?: unknown; contentType?: unknown }
    const mediaSid = typeof mm.mediaSid === 'string' ? mm.mediaSid : ''
    if (!/^ME[a-f0-9]{32}$/.test(mediaSid)) return []
    return [{ messageSid: sid, mediaSid, contentType: typeof mm.contentType === 'string' ? mm.contentType : 'application/octet-stream' }]
  })
}

// Row colours, named once. The feed reads mostly in the secondary token; the
// pills use the wash/text token PAIRS the language already proves at AA
// (ADMIN_UI §4) rather than an alpha of the solid, which the tokens cannot
// express without color-mix.
const QUIET = { color: 'var(--a-text-2)' }
const STRONG = { color: 'var(--a-text)' }
const PILL_WARN = { background: 'var(--a-warn-wash)', color: 'var(--a-warn)' }
const PILL_ACCENT = { background: 'var(--a-accent-wash)', color: 'var(--a-accent)' }
const HAIRLINE = { borderColor: 'var(--a-border)' }

function fmtDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string): string {
  return fmtDateTimeFn(iso)
}

/** Channel glyph + the FUB row's title + participant lines for one event. */
function rowMeta(e: ConversationEvent, personName: string) {
  const out = e.kind.endsWith('_out')
  if (e.kind.startsWith('email')) {
    return {
      Icon: Mail,
      title: e.title?.trim() || (out ? `Email to ${personName}` : `Email from ${personName}`),
      participant: personName,
    }
  }
  if (e.kind.startsWith('sms')) {
    return {
      Icon: MessageSquare,
      title: out ? `${e.broker ?? 'You'} texted ${personName}` : `${personName} texted you`,
      participant: null as string | null,
    }
  }
  if (e.kind === 'voicemail') {
    return { Icon: Voicemail, title: e.title?.trim() || 'Voicemail', participant: null as string | null }
  }
  return { Icon: Phone, title: e.title?.trim() || (out ? 'Outbound call' : 'Inbound call'), participant: null as string | null }
}

export default function ConversationFeed({
  events,
  personName,
  engagement,
  personId,
  initialCursor = null,
}: {
  events: ConversationEvent[]
  personName: string
  engagement?: Record<string, EmailEngagement>
  /** Enables the "load older messages" pager (full history, not just the latest). */
  personId?: number
  initialCursor?: string | null
}) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [items, setItems] = useState<ConversationEvent[]>(events)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()
  // Inbound spam blocking: numbers blocked this session + the one in flight.
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [blockPending, setBlockPending] = useState<string | null>(null)

  function blockNumber(phone: string) {
    setBlockPending(phone)
    startTransition(async () => {
      const r = await blockCrmNumber(phone, { reason: 'spam' })
      if (r.ok) setBlocked((prev) => new Set(prev).add(phone))
      setBlockPending(null)
    })
  }

  function loadOlder() {
    if (!personId || !cursor) return
    startTransition(async () => {
      const { loadContactConversation } = await import('@/app/actions/crm-conversation')
      const res = await loadContactConversation(personId, cursor)
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
    })
  }

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm" style={QUIET}>
        No texts or emails with {personName} yet. Start one below.
      </p>
    )
  }

  return (
    <>
    <ul className="divide-y divide-[color:var(--a-border)]">
      {items.map((e) => {
        const { Icon, title, participant } = rowMeta(e, personName)
        const preview = (e.body ? timelineEmailBody(e.body) : '') || ''
        // Legacy imported messages with content redacted
        // (payload.contentHidden === true, body null) — show a labeled
        // placeholder rather than a blank row.
        const contentHidden = !preview && e.payload?.contentHidden === true
        const expanded = openId === e.id
        const out = e.kind.endsWith('_out')
        const isEmail = e.kind.startsWith('email')

        const eng = isEmail && out && e.title ? engagement?.[e.title.trim()] : undefined
        const opened = eng && eng.opens > 0

        const media = mediaOf(e.payload)
        const recordingSid = recordingSidOf(e.payload)
        const spamSuspected = Boolean(e.payload && e.payload.spamSuspected === true)
        const group = groupInfoFromPayload(e.payload)
        // Only inbound calls/voicemails carry an external caller to block — on an
        // outbound call `fromNumber` is OUR broker line, so never offer to block it.
        const isInbound = e.kind === 'voicemail' || (e.kind === 'call' && e.payload?.direction !== 'out')
        const callerNumber = isInbound && e.payload && typeof e.payload.fromNumber === 'string' ? e.payload.fromNumber : null

        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setOpenId(expanded ? null : e.id)}
              aria-expanded={expanded}
              // The hover wash stays a CLASS — an inline background would win
              // over it and leave the row dead under the pointer.
              className="flex w-full gap-3 py-3 text-left transition-colors hover:bg-[var(--a-inset)]"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--a-accent)' }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={STRONG}>
                    {title}
                    {spamSuspected ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-medium" style={PILL_WARN}>
                        <ShieldAlert className="h-3 w-3" aria-hidden /> Possible spam
                      </span>
                    ) : null}
                    {group ? (
                      <span
                        className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-medium"
                        style={PILL_ACCENT}
                        title={`Group text · ${group.participants.join(', ')}`}
                      >
                        <Users className="h-3 w-3" aria-hidden /> Group · {group.count}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs" style={QUIET}>{fmtDate(e.ts)}</span>
                </div>
                {participant ? <div className="truncate text-sm" style={STRONG}>{participant}</div> : null}
                {preview ? (
                  <div className={expanded ? 'mt-0.5 whitespace-pre-wrap break-words text-sm' : 'mt-0.5 line-clamp-2 text-sm'} style={QUIET}>
                    {preview}
                  </div>
                ) : contentHidden ? (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs italic" style={QUIET}>
                    <EyeOff className="h-3 w-3" aria-hidden />
                    Content not imported
                  </div>
                ) : null}
                {opened ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--a-ok)' }}>
                    <MailOpen className="h-3.5 w-3.5" aria-hidden />
                    {eng!.opens} open{eng!.opens > 1 ? 's' : ''}
                    {eng!.lastOpen ? ` · Last opened ${fmtDate(eng!.lastOpen)}` : ''}
                    {eng!.clicks > 0 ? ` · ${eng!.clicks} click${eng!.clicks > 1 ? 's' : ''}` : ''}
                  </div>
                ) : null}
              </div>
            </button>

            {expanded ? (
              <div className="ml-8 space-y-2 pb-3">
                {media.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {media.map((m) => {
                      const src = `/api/admin/crm/mms/${m.messageSid}/${m.mediaSid}`
                      return m.contentType.startsWith('image/') ? (
                        <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="MMS attachment" className="h-28 w-28 rounded-lg border object-cover" style={HAIRLINE} loading="lazy" />
                        </a>
                      ) : (
                        <a
                          key={m.mediaSid}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border px-3 py-2 text-xs text-[color:var(--a-text)] hover:bg-[var(--a-inset)]"
                          style={HAIRLINE}
                        >
                          Attachment
                        </a>
                      )
                    })}
                  </div>
                ) : null}
                {/* Stored outbound attachments (sent email files + 1:1 MMS media). */}
                <StoredAttachmentStrip payload={e.payload} align="start" />
                {recordingSid ? (
                  <audio controls preload="none" src={`/api/admin/crm/recording/${recordingSid}`} className="h-8 w-full max-w-sm">
                    <track kind="captions" />
                  </audio>
                ) : null}
                {callerNumber && (e.kind === 'call' || e.kind === 'voicemail') ? (
                  <Button
                    type="button"
                    variant={spamSuspected ? 'danger' : 'quiet'}
                    disabled={blockPending === callerNumber || blocked.has(callerNumber)}
                    onClick={(ev) => { ev.stopPropagation(); blockNumber(callerNumber) }}
                    className="h-8 gap-1.5"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                    {blocked.has(callerNumber) ? 'Blocked' : blockPending === callerNumber ? 'Blocking…' : 'Block this number'}
                  </Button>
                ) : null}
                <div className="text-xs" style={QUIET}>{fmtDateTime(e.ts)}</div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
    {cursor ? (
      <div className="pt-2 text-center">
        <Button variant="quiet" onClick={loadOlder} disabled={pending}>
          {pending ? 'Loading…' : 'Load older messages'}
        </Button>
      </div>
    ) : null}
    </>
  )
}
