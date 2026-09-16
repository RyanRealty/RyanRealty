/**
 * Compose group rules — Apple Messages semantics.
 *
 * Two or more people in To: is one group thread. Prefer one carrier group;
 * if that fails, fan out per person with a truthful notice — never a silent
 * zero-send ("nobody was texted").
 */

export const GROUP_THREAD_FAILED =
  'Could not start one group thread. Nobody was texted separately.'

/** Shown when the carrier group fails but each person was texted 1:1. */
export const GROUP_THREAD_FALLBACK_NOTICE =
  'Could not start one group thread — texted each person separately.'

export type ComposePersonChip = {
  id: number
  name: string
  phone: string | null
  email: string | null
}

export function composeRecipientPayload(people: Array<{ id: number }>): {
  personId: number | null
  extraIds: string
  isGroup: boolean
} {
  const ids = [...new Set(people.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0))]
  return {
    personId: ids[0] ?? null,
    extraIds: ids.slice(1).join(','),
    isGroup: ids.length >= 2,
  }
}

/** True when To: has two or more people — that is a group, not three one-offs. */
export function isComposeGroup(people: Array<{ id: number }>): boolean {
  return composeRecipientPayload(people).isGroup
}

/**
 * After a group-thread attempt, decide whether 1:1 fan-out is allowed.
 * Explicit group compose (2+ people) always allows honest per-person delivery
 * when the carrier group did not form — never silent zero-send.
 */
export function decideGroupSmsFallback(params: {
  explicitGroupThread: boolean
  groupFormed: boolean
}): { allowFanOut: boolean; notice?: string; error?: string } {
  if (params.groupFormed) return { allowFanOut: false }
  if (params.explicitGroupThread) {
    return { allowFanOut: true, notice: GROUP_THREAD_FALLBACK_NOTICE }
  }
  return { allowFanOut: true }
}

export function emailsForCompose(
  people: Array<{ email: string | null | undefined }>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of people) {
    const email = (p.email ?? '').trim()
    if (!email || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    out.push(email)
  }
  return out
}
