/**
 * timeline-artifacts — a valuation send in the person thread is an ARTIFACT
 * event, not just an email: its row doors to the document (surface bar rule 4,
 * Matt 2026-09-01 "one comms story per lead"). New sends stamp
 * payload.artifact ('cma' | 'bpo'); older rows are recognized by the send
 * body their writers have always produced (lib/cma/send.ts · lib/bpo/send.ts).
 * Pure — shared by the person-detail EventCard and the v2 thread bubbles.
 */
export function timelineArtifactDoor(
  payload: Record<string, unknown> | null | undefined,
  body: string | null | undefined,
): { label: string; href: string } | null {
  const p = payload ?? {}
  const slug = typeof p.slug === 'string' && p.slug ? p.slug : null
  if (!slug) return null
  const isCma = p.artifact === 'cma' || /^CMA sent /.test(body ?? '')
  const isBpo = p.artifact === 'bpo' || /^Broker price opinion sent /.test(body ?? '')
  if (isCma) return { label: 'CMA · open', href: `/admin/cmas/${slug}` }
  if (isBpo) return { label: 'Price opinion · open', href: `/admin/bpo/${slug}` }
  return null
}
