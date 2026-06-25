/**
 * InboxThread — the message list for one open conversation (Wave 7).
 *
 * Renders the ActivityFeedItem[] from getConversationThread (the same source the
 * Contact-360 timeline uses) as a chat-style stream: inbound left, outbound
 * right, calls and notes as centered markers. Server component — every timestamp
 * is pre-formatted by the page (no client Date), passed via the formatted items.
 */

import { cn } from '@/lib/utils'
import type { ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'

export type FormattedThreadItem = ActivityFeedItem & { tsLabel: string }

const MARKER_CATEGORIES = new Set(['call', 'note', 'system', 'milestone', 'web'])

export default function InboxThread({
  items,
  personName,
}: {
  items: FormattedThreadItem[]
  personName: string
}) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No texts or emails with {personName} yet. Reply below to start one.
      </p>
    )
  }

  // Items arrive newest-first; flex-col-reverse renders oldest on top while the
  // DOM order keeps the latest message pinned to the scroll end.
  return (
    <div className="flex max-h-96 flex-col-reverse gap-3 overflow-y-auto pr-1 sm:max-h-160">
      {items.map((e) => {
        const isMarker = MARKER_CATEGORIES.has(e.category)
        if (isMarker) {
          return (
            <div key={e.id} className="flex flex-col items-center gap-1.5">
              <div className="rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
                {e.label}
                {e.snippet ? ` · ${e.snippet.slice(0, 80)}` : ''} · {e.tsLabel}
              </div>
              {e.recordingSid ? (
                <audio
                  controls
                  preload="none"
                  src={`/api/admin/crm/recording/${e.recordingSid}`}
                  className="h-8 w-full max-w-sm"
                >
                  <track kind="captions" />
                </audio>
              ) : null}
            </div>
          )
        }
        const out = e.direction === 'out'
        return (
          <div key={e.id} className={cn('flex flex-col', out ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-xs whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed sm:max-w-md',
                out ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground',
              )}
            >
              {e.snippet ?? e.label}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {out ? e.broker ?? 'us' : personName} · {e.tsLabel}
            </div>
          </div>
        )
      })}
    </div>
  )
}
