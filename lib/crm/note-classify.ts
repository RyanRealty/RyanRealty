/**
 * Note classifier — split crm_timeline notes (kind='note') into broker-written
 * ("human") vs auto-generated ("system") so the person-detail Notes view can
 * surface Matt's own notes ABOVE the automation firehose.
 *
 * WHY: long-running contacts accumulate hundreds of system notes (an expired
 * lead like #18187 had 212 notes, ~211 of them "Automated outreach packet
 * generated…"). A pure reverse-chron list buries the one hand-written note.
 * This is a DISPLAY-ONLY ranking — no note is deleted or hidden; the system
 * notes just render below the human ones in a de-emphasized group.
 *
 * PURE: no DB, no React — the grouping is unit-tested in isolation and both the
 * desktop (PersonCenterColumn) and mobile (MobileNotesTab) surfaces consume it.
 *
 * CLASSIFIER (derived from the live distribution, 2026-07-02):
 *   Signals, in order of confidence —
 *   1. broker set (non-null)                  → HUMAN. A broker authored it
 *      (e.g. the 147 'smart-followup' notes = Matt's drafted outreach copy).
 *   2. body matches a known automation template → SYSTEM:
 *        - "Automated outreach packet generated…" (the outreach-packet cron,
 *          ~8k rows; the exact note that drowned #18187)
 *        - a system-event prefix: EXPIRED LISTING / LEAD ORIGIN /
 *          Viewed property: / Matt alert: / "… is back on the website"
 *        - the FUB action-plan feedback link
 *   3. everything else                         → HUMAN (default).
 *
 *   The big bucket (~14k 'fub-import', broker-null, no template) is a MIX of
 *   real hand-written notes imported from FUB (which lost broker attribution on
 *   import) and FUB activity. Per the mission directive, when a note is
 *   genuinely ambiguous we DEFAULT IT TO HUMAN — better to show a note than
 *   bury it, which is the entire point of this fix. source alone is NOT a
 *   discriminator ('dual-write' holds both packets and real notes), so we never
 *   classify on source; only broker + body template.
 */

/** The minimal note shape the classifier needs (matches TimelineItem / MobileNote). */
export interface ClassifiableNote {
  broker: string | null
  body: string | null
  title?: string | null
}

/**
 * Body patterns that only an automation writes. Anchored at the start of the
 * note so a broker quoting one of these phrases mid-note is not misclassified.
 */
const SYSTEM_BODY_PATTERNS: RegExp[] = [
  /^Automated outreach packet generated/i,
  /^EXPIRED LISTING\b/,
  /^LEAD ORIGIN\b/,
  /^Viewed property:/i,
  /^Matt alert:/i,
  /is back on the website/i,
  /^Let our product team know what you thought of this action plan/i,
]

/** True when the note was written by an automation (not a broker). */
export function isSystemNote(note: ClassifiableNote): boolean {
  // Signal 1: a broker authored it → always human, regardless of body.
  if (note.broker) return false

  // Signal 2: a known automation template → system.
  const text = `${note.title ?? ''}\n${note.body ?? ''}`
  return SYSTEM_BODY_PATTERNS.some((re) => re.test(text.trimStart()))
}

/** True when the note is broker-written (or ambiguous → defaults to human). */
export function isHumanNote(note: ClassifiableNote): boolean {
  return !isSystemNote(note)
}

/**
 * Split an already-sorted (newest-first) note list into the two render groups.
 * Order within each group is preserved from the input, so callers keep their
 * reverse-chron ordering — human notes float to the top, system notes below.
 */
export function partitionNotes<T extends ClassifiableNote>(
  notes: readonly T[],
): { human: T[]; system: T[] } {
  const human: T[] = []
  const system: T[] = []
  for (const n of notes) {
    if (isSystemNote(n)) system.push(n)
    else human.push(n)
  }
  return { human, system }
}
