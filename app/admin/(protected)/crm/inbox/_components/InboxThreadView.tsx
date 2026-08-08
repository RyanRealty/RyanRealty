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

import '@/components/admin/v2/admin-v2.css'
import { Download, Users, Check, CheckCheck, Clock3, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import type { DeliveryTone } from '@/lib/crm/sms-delivery'
import type { InboxThreadItemData } from '@/lib/data/crm/getInboxThread'

/** Compact delivery indicator under an outbound bubble (sent/delivered/failed). */
function DeliveryChip({ delivery }: { delivery: { label: string; tone: DeliveryTone } }) {
  const Icon =
    delivery.tone === 'delivered' ? CheckCheck : delivery.tone === 'sent' ? Check : delivery.tone === 'failed' ? TriangleAlert : Clock3
  const color =
    delivery.tone === 'delivered'
      ? 'var(--a-ok)'
      : delivery.tone === 'failed'
        ? 'var(--a-danger)'
        : 'var(--a-text-2)'
  return (
    <span className="inline-flex items-center gap-1" style={{ color }}>
      <Icon className="h-3 w-3" aria-hidden />
      {delivery.label}
    </span>
  )
}

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
    <div className="rounded-xl" style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)' }}>
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2"
        style={{ borderBottom: '1px solid var(--a-border)' }}
      >
        <div className="min-w-0">
          <span className="font-medium" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
            {out ? item.broker ?? 'Ryan Realty' : personName}
          </span>
          {item.subject ? (
            <span className="ml-2 truncate" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {item.subject}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {item.label} · {item.tsLabel}
        </span>
      </div>
      <div className="px-4 py-3">
        {item.contentHidden ? (
          <p className="italic" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Message content is unavailable (redacted by the legacy CRM export).
          </p>
        ) : body && looksLikeHtml(body) ? (
          <div
            className="no-scrollbar overflow-x-auto [&_a]:underline [&_a]:[color:var(--a-accent)] [&_img]:h-auto [&_img]:[max-width:100%] [&_table]:[max-width:100%]"
            style={{ fontSize: 'var(--a-text-sm)', lineHeight: 'var(--a-leading)', color: 'var(--a-text)' }}
            // Sanitized above — scripts/styles/iframes/event handlers stripped.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
          />
        ) : (
          <p
            className="whitespace-pre-wrap"
            style={{ fontSize: 'var(--a-text-sm)', lineHeight: 'var(--a-leading)', color: 'var(--a-text)' }}
          >
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
      <div
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <span className="font-medium" style={{ color: 'var(--a-text)' }}>
          {isVoicemail ? 'Voicemail' : item.label}
        </span>
        <span className="tabular-nums">{item.tsLabel}</span>
        {item.recordingDurationSec != null ? (
          <span className="tabular-nums" style={{ fontFamily: 'var(--a-font-mono)' }}>
            {mmss(item.recordingDurationSec)}
          </span>
        ) : null}
        {item.snippet ? <span>· {item.snippet.slice(0, 80)}</span> : null}
        {item.recordingSid ? (
          <a
            href={`/api/admin/crm/recording/${item.recordingSid}`}
            download
            className="inline-flex items-center gap-0.5 hover:underline"
            style={{ color: 'var(--a-accent)' }}
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
          className="h-8 w-full"
          style={{ maxWidth: 384 }}
        >
          <track kind="captions" />
        </audio>
      ) : null}
    </div>
  )
}

function NoteItem({ item }: { item: InboxThreadViewItem }) {
  return (
    <div
      className="rounded-xl px-4 py-2.5"
      style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-semibold uppercase tracking-wide"
          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          Note · {item.broker ?? 'team'}
        </span>
        <span className="tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {item.tsLabel}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
        {item.fullBody ?? item.snippet}
      </p>
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
      <p className="py-16 text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        No communication yet
      </p>
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
              {e.group ? (
                <span
                  className="mb-0.5 inline-flex items-center gap-1 font-medium"
                  style={{
                    border: '1px solid var(--a-border)',
                    borderRadius: 'var(--a-r-sm)',
                    padding: '2px 8px',
                    fontSize: 'var(--a-text-xs)',
                    color: 'var(--a-text-2)',
                    background: 'var(--a-surface)',
                  }}
                  title={`Group text · ${e.group.participants.join(', ')}`}
                >
                  <Users className="h-3 w-3" aria-hidden /> Group · {e.group.count} people
                </span>
              ) : null}
              <div className={cn('av2-bubble', out ? 'av2-bubble--out' : 'av2-bubble--in')}>
                <div className="av2-bubble__txt whitespace-pre-wrap" style={{ lineHeight: 'var(--a-leading)' }}>
                  {e.contentHidden ? <em>Content unavailable</em> : e.fullBody ?? e.snippet ?? e.label}
                </div>
              </div>
              <div
                className="mt-0.5 flex items-center gap-1.5"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                <span>
                  {out ? e.broker ?? 'us' : personName} · {e.tsLabel}
                </span>
                {out && e.delivery ? (
                  <>
                    <span aria-hidden>·</span>
                    <DeliveryChip delivery={e.delivery} />
                  </>
                ) : null}
              </div>
            </div>
          )
        }
        // system / milestone / web / other — centered marker
        return (
          <div key={e.id} className="av2-sysnote">
            {e.label}
            {e.snippet ? ` · ${e.snippet.slice(0, 80)}` : ''} · {e.tsLabel}
          </div>
        )
      })}
    </div>
  )
}
