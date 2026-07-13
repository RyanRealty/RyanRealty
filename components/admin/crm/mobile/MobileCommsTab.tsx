/**
 * MobileCommsTab — §25.6 Comms tab for the mobile Contact Detail
 *
 * A chronological list of inbound/outbound emails, texts, and calls.
 * Newest first. Matches the FUB iOS Comms tab anatomy:
 *   - Email row: envelope icon (accent) · bold subject · sender+thread badge · preview · date
 *   - Archived label in muted text
 *   - Open-tracking sub-row: orange envelope + "N open(s)" + "Last opened [date]"
 *   - SMS row: overlapping speech-bubble icon (blue-purple) · participant text · preview · date
 *
 * This is a thin wrapper that delegates to the existing ConversationFeed for the
 * actual row rendering (it's already FUB-matched). We add the §25.6 section bg
 * and the empty-state per spec.
 *
 * Server component — no client state needed at the container level.
 */

import type { ConversationMessage } from '@/lib/data/crm/getContactConversation'
import ConversationFeed from '@/components/admin/crm/ConversationFeed'
import type { EmailEngagement } from '@/components/admin/crm/ConversationFeed'

export interface MobileCommsTabProps {
  personId: number
  personName: string
  items: ConversationMessage[]
  nextCursor: string | null
  engagement: Record<string, EmailEngagement>
  /** iMessage-style composer, pinned to the bottom of the tab so a broker who
   *  deep-links here (#comms) from a new-text alert can reply from their phone
   *  without hunting for a control. Sends from the business line. */
  composer?: React.ReactNode
}

export function MobileCommsTab({
  personId,
  personName,
  items,
  nextCursor,
  engagement,
  composer,
}: MobileCommsTabProps) {
  return (
    // Fill the viewport below the header + tab strip (~8.5rem) so the composer
    // sticks to the bottom like a messaging app, with the thread scrolling above.
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
            <p className="text-[16px] font-medium text-muted-foreground">No messages yet</p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Start the conversation below. Emails, texts, and calls show up here.
            </p>
          </div>
        ) : (
          // §25.6.1: bg-secondary content area; ConversationFeed renders on bg-card
          <div className="pb-3">
            <ConversationFeed
              events={items}
              initialCursor={nextCursor}
              personId={personId}
              engagement={engagement}
              personName={personName}
            />
          </div>
        )}
      </div>

      {composer ? (
        <div
          className="sticky bottom-0 z-20 border-t border-border bg-card px-3 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          {composer}
        </div>
      ) : null}
    </div>
  )
}
