/**
 * InboxThreadView — the reading-pane thread body (spec §08 §5.2–§5.6).
 *
 * Renders the conversation per channel:
 *   - Emails: full rich HTML inline (AC-08), sanitized via lib/sanitize, with
 *     subject + sender line. Plain-text emails render pre-wrap.
 *   - SMS: conversation bubbles — outbound right/navy, inbound left (AC-09).
 *   - Calls/voicemails: timeline entries with type label, date+time, duration
 *     MM:SS, download + inline play controls (AC-10).
 *   - Notes: internal-note cards (visually distinct from messages, §10.3).
 *   - System/web events: centered markers.
 *
 * Server component — timestamps pre-formatted by the page (no client Date).
 */

import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import type { InboxThreadItemData } from '@/lib/data/crm/getInboxThread'

export type InboxThreadViewItem = InboxThreadItemData & { tsLabel: string }

function looksLikeHtml(body: string): boolean {
  return /<([a-z][a-z0-9]*)\b[^>]*>/i.test(body)
}

/** MM:SS for call durations. */
function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function EmailItem({ item, personName }: { item: InboxThreadViewItem; personName: string }) {
  const out = item.direction === 'out'
  const body = item.fullBody ?? ''
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">
            {out ? item.broker ?? 'Ryan Realty' : personName}
          </span>
          {item.subject ? (
            <span className="ml-2 truncate text-sm text-muted-foreground">{item.subject}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {item.label} · {item.tsLabel}
        </span>
      </div>
      <div className="px-4 py-3">
        {item.contentHidden ? (
          <p className="text-sm italic text-muted-foreground">
            Message content is unavailable (redacted by the legacy CRM export).
          </p>
        ) : body && looksLikeHtml(body) ? (
          <div
            className="no-scrollbar overflow-x-auto text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full"
            // Sanitized above — scripts/styles/iframes/event handlers stripped.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {body || item.snippet || '(no content)'}
          </p>
        )}
      </div>
    </div>
  )
}

function CallItem({ item }: { item: InboxThreadViewItem }) {
  const isVoicemail = item.kind === 'voicemail'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{isVoicemail ? 'Voicemail' : item.label}</span>
        <span className="tabular-nums">{item.tsLabel}</span>
        {item.recordingDurationSec != null ? (
          <span className="font-mono tabular-nums">{mmss(item.recordingDurationSec)}</span>
        ) : null}
        {item.snippet ? <span>· {item.snippet.slice(0, 80)}</span> : null}
        {item.recordingSid ? (
          <a
            href={`/api/admin/crm/recording/${item.recordingSid}`}
            download
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
            aria-label="Download recording"
          >
            <Download className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {item.recordingSid ? (
        <audio
          controls
          preload="none"
          src={`/api/admin/crm/recording/${item.recordingSid}`}
          className="h-8 w-full max-w-sm"
        >
          <track kind="captions" />
        </audio>
      ) : null}
    </div>
  )
}

function NoteItem({ item }: { item: InboxThreadViewItem }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Note · {item.broker ?? 'team'}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{item.tsLabel}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.fullBody ?? item.snippet}</p>
    </div>
  )
}

export default function InboxThreadView({
  items,
  personName,
}: {
  items: InboxThreadViewItem[]
  personName: string
}) {
  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">No communication yet</p>
    )
  }

  // Items arrive newest-first; flex-col-reverse renders oldest on top while the
  // DOM order keeps the latest message pinned to the scroll end.
  return (
    <div className="flex flex-col-reverse gap-3">
      {items.map((e) => {
        if (e.category === 'email') return <EmailItem key={e.id} item={e} personName={personName} />
        if (e.category === 'call') return <CallItem key={e.id} item={e} />
        if (e.category === 'note') return <NoteItem key={e.id} item={e} />
        if (e.category === 'message') {
          const out = e.direction === 'out'
          return (
            <div key={e.id} className={cn('flex flex-col', out ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-xs whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed sm:max-w-md',
                  out
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-muted text-foreground',
                )}
              >
                {e.contentHidden ? <em>Content unavailable</em> : e.fullBody ?? e.snippet ?? e.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {out ? e.broker ?? 'us' : personName} · {e.tsLabel}
              </div>
            </div>
          )
        }
        // system / milestone / web / other — centered marker
        return (
          <div key={e.id} className="flex justify-center">
            <div className="rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
              {e.label}
              {e.snippet ? ` · ${e.snippet.slice(0, 80)}` : ''} · {e.tsLabel}
            </div>
          </div>
        )
      })}
    </div>
  )
}
