/**
 * Chat-style conversation view for a CRM person — texts and emails only,
 * inbound left, outbound right, newest at the bottom (flex-col-reverse keeps
 * the scroll pinned to the latest message). Calls and voicemails appear as
 * centered markers.
 */
import { timelineEmailBody } from '@/lib/crm/email-body'
import { StoredAttachmentStrip } from '@/components/admin/crm/StoredAttachments'

export type ConversationEvent = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  broker: string | null
  payload?: Record<string, unknown> | null
}

const RECORDING_SID_RE = /^RE[a-f0-9]{32}$/
function recordingSidOf(payload: ConversationEvent['payload']): string | null {
  const sid = payload && typeof payload.recordingSid === 'string' ? payload.recordingSid : null
  return sid && RECORDING_SID_RE.test(sid) ? sid : null
}

/** Inbound MMS attachments on a message bubble, resolved to admin proxy URLs. */
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

const COMMS_KINDS = new Set(['sms_in', 'sms_out', 'email_in', 'email_out', 'call', 'voicemail'])

export function isConversationEvent(kind: string): boolean {
  return COMMS_KINDS.has(kind)
}

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

export type EmailEngagement = { opens: number; lastOpen: string | null; clicks: number }

export default function ConversationThread({
  events,
  personName,
  engagement,
}: {
  events: ConversationEvent[]
  personName: string
  engagement?: Record<string, EmailEngagement>
}) {
  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No texts or emails with {personName} yet. Start one below.
      </p>
    )
  }
  // events arrive newest-first; flex-col-reverse renders them oldest-on-top
  // while the DOM order keeps the latest message adjacent to the scroll end.
  return (
    <div className="flex max-h-96 flex-col-reverse gap-3 overflow-y-auto pr-1 sm:max-h-160">
      {events.map((e) => {
        const out = e.kind.endsWith('_out')
        const isEmail = e.kind.startsWith('email')
        const isMarker = e.kind === 'call' || e.kind === 'voicemail'
        const text = (e.body ? timelineEmailBody(e.body) : e.title) ?? ''
        if (isMarker) {
          const recordingSid = recordingSidOf(e.payload)
          const durRaw = e.payload?.recordingDurationSec
          const dur = typeof durRaw === 'number' && Number.isFinite(durRaw) ? `${Math.round(durRaw)}s` : null
          const transcript = e.body ? timelineEmailBody(e.body) : null
          return (
            <div key={e.id} className="flex flex-col items-center gap-1.5">
              <div className="rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
                {e.kind === 'call' ? '📞' : '🎙'} {e.title ?? e.kind}
                {dur ? ` · ${dur}` : ''} · {fmtTs(e.ts)}
              </div>
              {recordingSid ? (
                <audio controls preload="none" src={`/api/admin/crm/recording/${recordingSid}`} className="h-8 w-full max-w-sm">
                  <track kind="captions" />
                </audio>
              ) : null}
              {transcript ? (
                <div className="max-w-md whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {transcript.slice(0, 1200)}
                  {transcript.length > 1200 ? '…' : ''}
                </div>
              ) : null}
            </div>
          )
        }
        return (
          <div key={e.id} className={`flex flex-col ${out ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-xs whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed sm:max-w-md ${
                out
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm bg-muted text-foreground'
              }`}
            >
              {isEmail && e.title ? <div className={`mb-1 text-xs font-semibold ${out ? 'opacity-85' : 'text-muted-foreground'}`}>✉ {e.title}</div> : null}
              {text.slice(0, 1200)}
              {text.length > 1200 ? '…' : ''}
            </div>
            {(() => {
              const media = mediaOf(e.payload)
              if (!media.length) return null
              return (
                <div className={`mt-1 flex max-w-xs flex-wrap gap-1.5 sm:max-w-md ${out ? 'justify-end' : 'justify-start'}`}>
                  {media.map((m) => {
                    const src = `/api/admin/crm/mms/${m.messageSid}/${m.mediaSid}`
                    return m.contentType.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer">
                        <img src={src} alt="MMS attachment" className="h-28 w-28 rounded-lg border border-border object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
                        📎 attachment
                      </a>
                    )
                  })}
                </div>
              )
            })()}
            {/* Stored outbound attachments (sent email files + 1:1 MMS media). */}
            <StoredAttachmentStrip payload={e.payload} align={out ? 'end' : 'start'} />
            <div className="mt-0.5 text-xs text-muted-foreground">
              {out ? (e.broker ?? 'us') : personName} · {fmtTs(e.ts)}
            </div>
            {(() => {
              if (!out || !isEmail || !e.title) return null
              const eng = engagement?.[e.title.trim()]
              if (!eng || (eng.opens === 0 && eng.clicks === 0)) {
                return <div className="mt-0.5 text-xs text-muted-foreground">Not opened yet</div>
              }
              return (
                <div className="mt-0.5 text-xs font-medium text-success">
                  {eng.opens > 0 ? `👁 Opened ${eng.opens}×${eng.lastOpen ? ` · last ${fmtTs(eng.lastOpen)}` : ''}` : 'Not opened yet'}
                  {eng.clicks > 0 ? ` · 🔗 clicked ${eng.clicks} link${eng.clicks > 1 ? 's' : ''}` : ''}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
