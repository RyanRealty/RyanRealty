/**
 * Compose group rules — Apple Messages semantics.
 *
 * Two or more people in To: is one group thread. The send path must not
 * silently fan out to one-off texts unless the broker asked for that.
 */

export const GROUP_THREAD_FAILED =
  'Could not start one group thread. Nobody was texted separately.'

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
 * `explicitGroupThread` is what the Apple compose surface sets for 2+ people.
 */
export function decideGroupSmsFallback(params: {
  explicitGroupThread: boolean
  groupFormed: boolean
}): { allowFanOut: boolean; error?: string } {
  if (params.groupFormed) return { allowFanOut: false }
  if (params.explicitGroupThread) return { allowFanOut: false, error: GROUP_THREAD_FAILED }
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
