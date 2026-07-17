/**
 * Same-tick double-submit guard for the canonical composers (Pain #2, 2026-07-17).
 *
 * Two clicks in one event-loop tick both dispatch a form submission BEFORE
 * React can render the disabled send button — and in the App Router the second
 * action POST ABORTS the first, so NEITHER response resolves: the composer
 * hung on "sending" forever while the server-side idempotency ledger silently
 * prevented the duplicate send (data safe, UI stuck — the audit's exact
 * "stalls on sending" complaint). Blocking the second SUBMISSION keeps the
 * first response alive: the send resolves, the redirect lands, the box clears.
 *
 * Pure and framework-free so the contract is unit-testable:
 *   - onSubmit(e): returns false + preventDefault()s when a submission is
 *     already in flight; records whether the submitter was the Save-draft
 *     button (data-composer-draft) so settle handlers keep a saved draft's
 *     text in the box.
 *   - settle(): releases the guard (call when useFormStatus pending falls —
 *     it fires for EVERY submission of the form, incl. formAction overrides).
 */

export type GuardedSubmitEvent = {
  preventDefault(): void
  nativeEvent: unknown
}

export function createSubmitGuard() {
  let submitting = false
  let lastWasDraft = false
  let searchAtSubmit: string | null = null
  return {
    /** Returns true when the submission may proceed. */
    onSubmit(e: GuardedSubmitEvent, currentSearch?: string): boolean {
      if (submitting) {
        e.preventDefault()
        return false
      }
      submitting = true
      searchAtSubmit = currentSearch ?? null
      const submitter = (e.nativeEvent as { submitter?: { hasAttribute?: (n: string) => boolean } | null })
        ?.submitter
      lastWasDraft = Boolean(submitter?.hasAttribute?.('data-composer-draft'))
      return true
    },
    /** Release after the action settles (success OR failure). */
    settle(): void {
      submitting = false
    },
    /** Was the last admitted submission the Save-draft button? */
    get lastWasDraft(): boolean {
      return lastWasDraft
    },
    /**
     * Success detector for the settle handler. The send wrappers differ —
     * person-page actions redirect ONLY on failure (?error=…), the inbox
     * wrapper redirects on success too — so neither "URL unchanged" nor
     * "has ?error" alone is reliable. The invariant that holds across both:
     * a FAILURE lands a NEW or CHANGED `error` param relative to submit time.
     * A stale ?error carried over from an earlier attempt (identical value)
     * is NOT this send's failure — without that comparison the box would
     * wrongly hold the sent text forever after any prior failure.
     */
    sendSucceeded(currentSearch: string): boolean {
      if (searchAtSubmit === null) return false
      const err = (s: string) => new URLSearchParams(s.startsWith('?') ? s.slice(1) : s).get('error')
      const errNow = err(currentSearch)
      if (!errNow) return true
      return errNow === err(searchAtSubmit)
    },
  }
}
