/**
 * Today "right now" strip — overdue sign-off, true inbound replies, looking-at.
 *
 * CMA opens, parked sequence steps, and duplicate person rows do not belong
 * on this screen. One action per person (newest reply wins).
 */

export const TODAY_RIGHT_NOW_CAP = 12

export type TodayTriageLike = {
  id: string
  kind: string
  personId: number
  occurredAt: string
}

export type TodayLookingLike = {
  personId: number
  occurredAt: string
}

export type TodaySignOffDealLike = {
  items: Array<{ deadline?: { overdue?: boolean } | null }>
}

/** True inbound replies only, newest per person. */
export function dedupeInboundReplies<T extends TodayTriageLike>(items: readonly T[]): T[] {
  const replies = items.filter((item) => item.kind === 'reply')
  const byPerson = new Map<number, T>()
  for (const row of replies) {
    const prev = byPerson.get(row.personId)
    if (!prev || row.occurredAt > prev.occurredAt) byPerson.set(row.personId, row)
  }
  return [...byPerson.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

/** Hide looking-at rows that already have a reply on the strip. */
export function lookingAtWithoutReplies<T extends TodayLookingLike>(
  looking: readonly T[],
  replyPersonIds: ReadonlySet<number>,
): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const row of looking) {
    if (replyPersonIds.has(row.personId) || seen.has(row.personId)) continue
    seen.add(row.personId)
    out.push(row)
  }
  return out
}

export function overdueSignOffDeals<T extends TodaySignOffDealLike>(deals: readonly T[]): T[] {
  return deals.filter((deal) => deal.items.some((item) => item.deadline?.overdue === true))
}

export function capRightNow<T>(rows: readonly T[], cap: number = TODAY_RIGHT_NOW_CAP): T[] {
  return rows.slice(0, Math.max(0, cap))
}
