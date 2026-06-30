'use client'

/**
 * FUB-clone Comms feed for a CRM person. Renders the contact's messages as a
 * chronological row list — one row per message, newest first — matching the
 * Follow Up Boss iOS Comms tab (channel icon · subject/descriptor · participant ·
 * 2-line preview · date · email open-count). Rows collapse to the FUB anatomy at
 * rest and expand on tap to reveal the full body, MMS attachments, and call
 * recordings (features FUB's collapsed rows don't carry, surfaced on demand).
 */
import { useState } from 'react'
import { Mail, MailOpen, MessageSquare, Phone, Voicemail } from 'lucide-react'
import { timelineEmailBody } from '@/lib/crm/email-body'

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
  if (!/^(MM|SM)[a-f0-9]{32}$/.test(sid)) return []
  const arr = Array.isArray(payload.media) ? payload.media : []
  return arr.flatMap((m) => {
    const mm = m as { mediaSid?: unknown; contentType?: unknown }
    const mediaSid = typeof mm.mediaSid === 'string' ? mm.mediaSid : ''
    if (!/^ME[a-f0-9]{32}$/.test(mediaSid)) return []
    return [{ messageSid: sid, mediaSid, contentType: typeof mm.contentType === 'string' ? mm.contentType : 'application/octet-stream' }]
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
  })
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
}: {
  events: ConversationEvent[]
  personName: string
  engagement?: Record<string, EmailEngagement>
}) {
  const [openId, setOpenId] = useState<number | null>(null)

  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No texts or emails with {personName} yet. Start one below.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {events.map((e) => {
        const { Icon, title, participant } = rowMeta(e, personName)
        const preview = (e.body ? timelineEmailBody(e.body) : '') || ''
        const expanded = openId === e.id
        const out = e.kind.endsWith('_out')
        const isEmail = e.kind.startsWith('email')

        const eng = isEmail && out && e.title ? engagement?.[e.title.trim()] : undefined
        const opened = eng && eng.opens > 0

        const media = mediaOf(e.payload)
        const recordingSid = recordingSidOf(e.payload)

        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setOpenId(expanded ? null : e.id)}
              aria-expanded={expanded}
              className="flex w-full gap-3 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.ts)}</span>
                </div>
                {participant ? <div className="truncate text-sm text-foreground">{participant}</div> : null}
                {preview ? (
                  <div className={expanded ? 'mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground' : 'mt-0.5 line-clamp-2 text-sm text-muted-foreground'}>
                    {preview}
                  </div>
                ) : null}
                {opened ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-success">
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
                          <img src={src} alt="MMS attachment" className="h-28 w-28 rounded-lg border border-border object-cover" loading="lazy" />
                        </a>
                      ) : (
                        <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
                          Attachment
                        </a>
                      )
                    })}
                  </div>
                ) : null}
                {recordingSid ? (
                  <audio controls preload="none" src={`/api/admin/crm/recording/${recordingSid}`} className="h-8 w-full max-w-sm">
                    <track kind="captions" />
                  </audio>
                ) : null}
                <div className="text-xs text-muted-foreground">{fmtDateTime(e.ts)}</div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
