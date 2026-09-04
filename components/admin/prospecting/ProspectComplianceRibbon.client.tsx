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
 * positively so the next action is obvious. Relisted / off-market hard-skip
 * clears Email OK paint via openChannels (Remarkable/Dodds class).
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md). The
 * shadcn Badge trio became StateWord, which already carries the "status is text
 * + color, never color alone" rule (av2-state--*) — destructive → `down`,
 * success → `ok`, warning → `slow`. Every word, every per-channel decision and
 * the fail-closed read underneath are unchanged; only the paint moved. The
 * blocked REASON stays plain text, not a StateWord: it is a sentence the
 * suppression source wrote, not one of the language's status words.
 */

import { StateWord } from '@/components/admin/v2'
import {
  openChannels,
  PROSPECT_CHANNELS,
  type ProspectChannel,
  type ProspectComplianceState,
} from '@/lib/data/prospecting/types'

const CHANNEL_LABEL: Record<ProspectChannel, string> = { sms: 'Text', email: 'Email', call: 'Call' }

export function ProspectComplianceRibbon({
  compliance,
  personId,
}: {
  compliance: ProspectComplianceState
  /** Effective send person; null clears Email/Text OK (Pine Vista farm-stub class). */
  personId?: number | null
}) {
  const blocked = PROSPECT_CHANNELS.filter((c) => compliance.channels[c].blocked)
  const open = openChannels({ ...compliance, personId })

  // Nothing to say: every channel open and no market-status caveat.
  if (blocked.length === 0 && !compliance.relisted && !compliance.offMarket) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="status">
      {compliance.allChannelsBlocked ? (
        <StateWord state="down">Do not contact</StateWord>
      ) : (
        <>
          {open.map((c) => (
            <StateWord key={`open-${c}`} state="ok">
              {CHANNEL_LABEL[c]} OK
            </StateWord>
          ))}
          {blocked.map((c) => (
            <StateWord key={`blocked-${c}`} state="slow">
              No {CHANNEL_LABEL[c].toLowerCase()}
            </StateWord>
          ))}
        </>
      )}
      {compliance.relisted ? <StateWord state="slow">Relisted</StateWord> : null}
      {compliance.offMarket ? <StateWord state="slow">Off market</StateWord> : null}

      {/* The single most important reason, spelled out. The full list lives on
          the detail page — a card ribbon that wraps to three lines is noise. */}
      {blocked.length > 0 && compliance.channels[blocked[0]].reason ? (
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {compliance.channels[blocked[0]].reason}
        </span>
      ) : null}
    </div>
  )
}
