/**
 * Shared shapes for the place-page value ask (SITE-01). No server code here: the
 * barrel primitive and the route's server action both import these, and the
 * primitive stays app-agnostic by taking the two calls as props.
 */

import type { AnswerFigure } from '@/lib/site/answer-figures'

export type PlaceValueAnswerInput = {
  slug: string
  address: string
  /** Honeypot value. Non-empty means a bot filled it. */
  company?: string
  sessionId?: string | null
}

export type PlaceValueAnswerResult =
  | {
      ok: true
      address: string
      headline: string
      body: string[]
      /**
       * The DRAWN answer (site queue SITE-02b). This replaced a `facts` array
       * of label-and-value pairs, which the separate evaluator scored 59 with
       * the defect named: "a label/value ledger rather than a drawing". Shaped
       * by buildAnswerFigures so this ask and the /sell ask draw the same three
       * figures with the same words.
       */
      figures: AnswerFigure[]
      source: string
      compCount: number | null
      subjectFound: boolean
      verdictLabel: string | null
    }
  | { ok: false; error: string }

export type PlaceValueRequestInput = {
  slug: string
  address: string
  email: string
  phone?: string
  company?: string
  sessionId?: string | null
}

export type PlaceValueRequestResult =
  | { ok: true; brokerFirst: string; bookHref: string }
  | { ok: false; error: string }
