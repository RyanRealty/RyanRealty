'use client'

/**
 * ProspectComplianceRibbon — what a broker may still legally do with this
 * prospect, per channel.
 *
 * Purely presentational: it reads the fail-closed per-channel snapshot the DAL
 * resolved (lib/data/prospecting/types.ts ProspectComplianceState.channels) and
 * never makes its own suppression/relist decision.
 *
 * Why per-channel: the old ribbon collapsed every block into one destructive
 * "Compliance hold" + "Suppressed" pair. 54 of 75 expired-listing owners carry
 * `contact:do-not-call` from the skip-trace DNC read, which correctly blocks SMS
 * and voice under TCPA but leaves EMAIL open — so the board looked like a wall
 * of do-not-contact leads that were in fact perfectly emailable (Brain Dump 2,
 * 2026-07-28). Only `allChannelsBlocked` is destructive now; a single closed
 * channel is a warning that names the reason, and the open channels are stated
 * positively so the next action is obvious.
 */

import { Badge } from '@/components/ui/badge'
import {
  openChannels,
  PROSPECT_CHANNELS,
  type ProspectChannel,
  type ProspectComplianceState,
} from '@/lib/data/prospecting/types'

const CHANNEL_LABEL: Record<ProspectChannel, string> = { sms: 'Text', email: 'Email', call: 'Call' }

export function ProspectComplianceRibbon({ compliance }: { compliance: ProspectComplianceState }) {
  const blocked = PROSPECT_CHANNELS.filter((c) => compliance.channels[c].blocked)
  const open = openChannels(compliance)

  // Nothing to say: every channel open and no market-status caveat.
  if (blocked.length === 0 && !compliance.relisted && !compliance.offMarket) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="status">
      {compliance.allChannelsBlocked ? (
        <Badge variant="destructive">Do not contact</Badge>
      ) : (
        <>
          {open.map((c) => (
            <Badge key={`open-${c}`} variant="success">
              {CHANNEL_LABEL[c]} OK
            </Badge>
          ))}
          {blocked.map((c) => (
            <Badge key={`blocked-${c}`} variant="warning">
              No {CHANNEL_LABEL[c].toLowerCase()}
            </Badge>
          ))}
        </>
      )}
      {compliance.relisted ? <Badge variant="warning">Relisted</Badge> : null}
      {compliance.offMarket ? <Badge variant="warning">Off market</Badge> : null}

      {/* The single most important reason, spelled out. The full list lives on
          the detail page — a card ribbon that wraps to three lines is noise. */}
      {blocked.length > 0 && compliance.channels[blocked[0]].reason ? (
        <span className="text-xs text-muted-foreground">{compliance.channels[blocked[0]].reason}</span>
      ) : null}
    </div>
  )
}
