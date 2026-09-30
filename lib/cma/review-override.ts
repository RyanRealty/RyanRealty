/**
 * Review sends the composed letter unless the broker changed the subject or
 * the body. An unedited box must not take the override path.
 */
export function cmaReviewOverrideIfEdited(
  current: { subject: string; bodyText: string },
  baseline: { subject: string; bodyText: string },
): { subject: string; bodyText: string } | undefined {
  const subject = current.subject.trim()
  const bodyText = current.bodyText.trim()
  const edited = subject !== baseline.subject.trim() || bodyText !== baseline.bodyText.trim()
  return edited ? { subject, bodyText } : undefined
}
