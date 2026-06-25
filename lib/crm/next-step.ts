/**
 * decideContactNextStep — the record card's one-click next step.
 *
 * Matt's rule (2026-06-24): the single recommended action on a contact is
 * driven by whether the person owns a home, NOT by sequence enrollment.
 *
 *   owns a home      → Send CMA       (give them a real read on their value)
 *   does not own one → Send newsletter (stay top of mind until they are ready)
 *
 * This is a PURE function so it is trivially testable and the UI can render the
 * branch without a server roundtrip once `ownsHome` is resolved.
 */

export type ContactNextStepKind = 'cma' | 'newsletter'

export type ContactNextStep = {
  kind: ContactNextStepKind
  /** Short button label. */
  label: string
  /** One-line explanation of why this is the next step. Brand-voice clean. */
  description: string
}

/**
 * Decide the next step for a contact from whether they own a home.
 * Keep copy free of em-dashes and semicolons (brand-voice gate).
 */
export function decideContactNextStep(input: { ownsHome: boolean }): ContactNextStep {
  if (input.ownsHome) {
    return {
      kind: 'cma',
      label: 'Send CMA',
      description: 'This contact owns a home. Send a comparative market analysis with what it is worth today.',
    }
  }
  return {
    kind: 'newsletter',
    label: 'Send newsletter',
    description: 'This contact does not own a home yet. Send the latest newsletter to stay top of mind.',
  }
}
