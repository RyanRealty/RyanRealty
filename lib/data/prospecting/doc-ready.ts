/**
 * Prospecting "Audit ready" paint gate.
 *
 * A built DRAFT must never paint ready-to-send / "Audit ready" — public and
 * outreach links only serve finalized|delivered (lib/cma/draft-access). List +
 * pill + classify share this helper so paint cannot drift from the send bar.
 */
import { isCmaClientReady } from '@/lib/cma/draft-access'

/** Statuses that mean the audit finished and the doc is client-sendable. */
export function isProspectDocClientReady(status: string | null | undefined): boolean {
  return isCmaClientReady(status)
}

/**
 * Built + client-ready: client-ready status AND a real html_path (not pending:).
 * draft + html_path → false; finalized + html_path → true.
 */
export function isProspectDocReady(
  status: string | null | undefined,
  htmlPath: string | null | undefined,
): boolean {
  return (
    isProspectDocClientReady(status) &&
    !!htmlPath &&
    !String(htmlPath).startsWith('pending:')
  )
}
