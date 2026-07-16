/**
 * Pure group-text detection (admin rebuild — RC1 clarity). Shared by the server
 * DAL (getContactActivityFeed) and client renderers (EventCard, ConversationFeed),
 * so it must NOT be server-only. A group text is written with payload.groupTo (the
 * send path) or payload.groupMembers + group:true (the inbound Conversations
 * webhook); a 1:1 has neither. Surfacing this is what makes a group message
 * unmistakable from a private one — the owner's stated #1 messaging confusion.
 */
export type GroupInfo = { count: number; participants: string[] }

export function groupInfoFromPayload(payload: unknown): GroupInfo | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const toArr = Array.isArray(p.groupTo) ? (p.groupTo as unknown[]) : null
  const memberArr = Array.isArray(p.groupMembers) ? (p.groupMembers as unknown[]) : null
  const raw = toArr ?? memberArr
  if (!raw) return null
  const participants = raw.map((x) => String(x)).filter(Boolean)
  // A "group" is 2+ participants; fewer is a 1:1 that was mislabeled — treat as 1:1.
  if (participants.length < 2) return null
  return { count: participants.length, participants }
}
