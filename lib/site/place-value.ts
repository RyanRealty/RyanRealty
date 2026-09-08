/**
 * Shared shapes for the place-page value ask (SITE-01). No server code here: the
 * barrel primitive and the route's server action both import these, and the
 * primitive stays app-agnostic by taking the two calls as props.
 */

export type PlaceValueFact = {
  label: string
  value: string
  note?: string
}

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
      facts: PlaceValueFact[]
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
