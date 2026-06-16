/**
 * Chat-style conversation view for a CRM person — texts and emails only,
 * inbound left, outbound right, newest at the bottom (flex-col-reverse keeps
 * the scroll pinned to the latest message). Calls and voicemails appear as
 * centered markers.
 */
import { timelineEmailBody } from '@/lib/crm/email-body'

export type ConversationEvent = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  broker: string | null
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
          return (
            <div key={e.id} className="self-center rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
              {e.kind === 'call' ? '📞' : '🎙'} {e.title ?? e.kind} · {fmtTs(e.ts)}
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
