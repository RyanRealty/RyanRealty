/**
 * Bubble / iMessage threads render oldest → newest (top → bottom), with the
 * latest message sitting just above the sticky composer.
 *
 * DAL readers (`getContactConversation`, `getConversationThreadFull`) keep
 * `order ts desc` so `LIMIT N` is the newest window. Reverse once at the
 * render boundary — do not flip the query (that would make LIMIT the oldest N).
 */
export function oldestFirst<T>(newestFirst: readonly T[]): T[] {
  if (newestFirst.length < 2) return newestFirst.slice()
  return newestFirst.slice().reverse()
}
