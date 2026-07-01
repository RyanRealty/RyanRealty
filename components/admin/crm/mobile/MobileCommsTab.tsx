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
}

export function MobileCommsTab({
  personId,
  personName,
  items,
  nextCursor,
  engagement,
}: MobileCommsTabProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
        <p className="text-[16px] font-medium text-muted-foreground">No messages yet</p>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Emails, texts, and calls show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* §25.6.1: bg-secondary content area; ConversationFeed renders the rows on bg-card */}
      <ConversationFeed
        events={items}
        initialCursor={nextCursor}
        personId={personId}
        engagement={engagement}
        personName={personName}
      />
    </div>
  )
}
