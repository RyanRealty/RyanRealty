/**
 * send-deliverable — the ONE governed chokepoint for deliverable sends
 * (admin rebuild spec 03 §6.1, "Unified Send").
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this module, a CMA, a broker price opinion, a market report, the
 * newsletter and a saved-search match email each had their own entry point with
 * its own auth shape, its own (or no) double-send guard, and its own free-text
 * error string that the UI could only render as a toast. Spec 03 §2 counted
 * three CMA send surfaces, two BPO surfaces and three market-report write
 * surfaces on one page. That is RC4 accretion, and it is exactly where a
 * double-send or an unguarded send hurts (C5: messages carry money and legal
 * weight).
 *
 * `runSendDeliverable` is the single path every deliverable send takes:
 *
 *   validate input  →  auth (requireCrmAccess)      →  errorKind 'auth'
 *                   →  the person actually exists   →  errorKind 'not_found'
 *                   →  person is in the caller's scope
 *                   →  AT-MOST-ONCE ledger claim (crm_idempotency_keys)
 *                   →  dispatch to the kept, already-guarded send engine
 *                   →  classify the engine's error into a stable errorKind
 *
 * SUPPRESSION / QUIET HOURS / ORS 696.820 DISCLOSURE ARE NOT RE-IMPLEMENTED
 * HERE. Every engine this dispatches to already enforces them fail-closed
 * (spec 03 §2 KEEP table, `send-center.md §9`). Re-implementing them at the
 * chokepoint would create a second policy that can drift from the one that
 * actually runs. The chokepoint's job is uniform auth, at-most-once, and one
 * error vocabulary — not a second copy of the send rules.
 *
 * DRAFT-FIRST HOLDS. Nothing in this module sends anything on its own; it is
 * only ever reached from an explicit broker tap.
 *
 * IDEMPOTENCY STORE: the A5 ledger `public.crm_idempotency_keys`, scope
 * `deliverable`, key `deliverable:{kind}:{personId}:{clientKey}`. Spec 03 §3.3
 * sketched a separate `crm_send_idempotency` table; the A5 ledger already
 * carries exactly that contract (claim → run once → store result → replay on
 * duplicate → RELEASE on failure so a real retry re-sends) and is already the
 * store for SMS, email and the newsletter one-off. A second table would be the
 * accretion this spec exists to remove, so this reuses the one ledger and
 * namespaces it by scope.
 *
 * This module is pure policy + a dependency-injected core so the contract is
 * unit-testable without a database. The real wiring lives in
 * `app/actions/send-deliverable.ts`.
 */

/** The deliverable concepts a broker can put in front of a contact. */
export type DeliverableKind = 'cma' | 'bpo' | 'market_report' | 'newsletter' | 'listing_matches'

/**
 * The kinds the chokepoint serves. The gate
 * (`scripts/check-deliverable-send-chokepoint.mjs`) pins this list against the
 * dispatch table, so adding a kind without a dispatch fails CI.
 */
export const DELIVERABLE_KINDS = [
  'cma',
  'bpo',
  'market_report',
  'newsletter',
  'listing_matches',
] as const satisfies readonly DeliverableKind[]

/**
 * One error vocabulary for every deliverable send, so the UI can react to a
 * CLASS of failure instead of pattern-matching prose. Spec 03 §6.1 names
 * suppressed / no_channel / not_ready / wrong_recipient / over_limit / auth /
 * quiet_hours / a2p / unknown; `bad_input`, `not_found` and `in_flight` are
 * added for the three states the chokepoint itself can produce.
 */
export type SendDeliverableErrorKind =
  | 'auth'
  | 'bad_input'
  | 'not_found'
  | 'suppressed'
  | 'no_channel'
  | 'not_ready'
  | 'wrong_recipient'
  | 'quiet_hours'
  | 'a2p'
  | 'over_limit'
  | 'in_flight'
  | 'unknown'

export interface SendDeliverableInput {
  personId: number
  kind: DeliverableKind
  /** CMA/BPO slug, newsletter issue id, etc. Kind-specific; see the dispatch. */
  ref?: string
  /** 'email' (default). 'sms' is a link-share rail, not a second document. */
  channel?: 'email' | 'sms'
  /** Client-generated, stable per user intent. Two taps = one key = one send. */
  idempotencyKey: string
  /** Kind-specific extras: areas[], includeOfferStrategy, filters, cadence… */
  override?: Record<string, unknown>
}

export interface SendDeliverableResult {
  ok: boolean
  kind: DeliverableKind
  personId: number
  error?: string
  errorKind?: SendDeliverableErrorKind
  /** Set when the result was replayed from the ledger rather than re-sent. */
  replayed?: boolean
}

/** What a dispatched engine hands back. Every kept engine already fits this. */
export interface DeliverableDispatchResult {
  ok: boolean
  error?: string
  message?: string
}

/**
 * The caller's CRM access is passed through OPAQUELY (generic `A`). It is never
 * narrowed or reconstructed here: `scopeBroker` keys the all-brokers path on
 * `role === 'superuser'`, and Matt's email ALSO maps to the 'matt' broker slug,
 * so rebuilding a reduced access shape would silently scope the owner to his
 * own assigned leads. The real `CrmAccess` travels intact from
 * `requireCrmAccess` to `requirePersonInScope`.
 */
export interface SendDeliverableDeps<A = unknown> {
  requireAccess: () => Promise<{ ok: true; access: A } | { ok: false; error: string }>
  requireScope: (personId: number, access: A) => Promise<{ ok: true } | { ok: false; error: string }>
  personExists: (personId: number) => Promise<boolean>
  withIdempotency: <T extends { ok: boolean }>(
    args: { key: string; scope: string; onInFlight: T },
    run: () => Promise<T>,
  ) => Promise<T>
  dispatch: Record<
    DeliverableKind,
    (input: SendDeliverableInput, access: A) => Promise<DeliverableDispatchResult>
  >
}

/** The ledger scope every deliverable send claims under. */
export const DELIVERABLE_IDEMPOTENCY_SCOPE = 'deliverable'

/**
 * The at-most-once ledger key. Namespaced by kind AND person so a broker who
 * sends a CMA and a market report from the same panel mount (one client uuid)
 * does not have the second send swallowed as a duplicate of the first.
 */
export function deliverableIdempotencyKey(
  kind: DeliverableKind,
  personId: number,
  clientKey: string,
): string {
  return `${DELIVERABLE_IDEMPOTENCY_SCOPE}:${kind}:${personId}:${clientKey.trim()}`
}

/**
 * Map an engine's free-text failure onto the stable vocabulary. Ordered
 * most-specific first: an authorization refusal must never be read as
 * "not ready", and a suppression block must never be read as "unknown" (the UI
 * renders suppression as a permanent stop, not a retry).
 *
 * Pure and exported so the classification is testable and so a new engine
 * message can be pinned by a test rather than discovered in production.
 */
export function classifySendError(message: string | null | undefined): SendDeliverableErrorKind {
  const m = (message ?? '').toLowerCase()
  if (!m) return 'unknown'
  if (/unauthorized|not authorized|forbidden|out of scope|not in your scope|access denied/.test(m)) return 'auth'
  if (/suppress|opted out|opt-out|opted-out|unsubscrib|hard stop|do not contact|dnc/.test(m)) return 'suppressed'
  if (/quiet hours?/.test(m)) return 'quiet_hours'
  if (/\ba2p\b|10dlc|not registered for texting/.test(m)) return 'a2p'
  if (/no email|no phone|without an email|no address on file|add an email|add one before sending/.test(m)) return 'no_channel'
  if (/wrong recipient|does not belong|different contact|recipient mismatch/.test(m)) return 'wrong_recipient'
  if (/rate limit|too many|over the limit|over limit|daily cap|quota/.test(m)) return 'over_limit'
  if (/not found|no such|does not exist/.test(m)) return 'not_found'
  if (/not ready|still a draft|is a draft|not finalized|approve it|no finalized|status:|nothing to send|is not ready/.test(m)) return 'not_ready'
  return 'unknown'
}

function fail(
  input: Pick<SendDeliverableInput, 'personId' | 'kind'>,
  errorKind: SendDeliverableErrorKind,
  error: string,
): SendDeliverableResult {
  return { ok: false, kind: input.kind, personId: input.personId, error, errorKind }
}

/**
 * THE chokepoint. Every deliverable send runs through this function.
 *
 * Contract (spec 03 §6.1):
 *  1. Input is validated before anything touches the database.
 *  2. Auth is IN-BODY — this is an independently invocable POST, so a layout
 *     guard cannot protect it (§4.4).
 *  3. The claim is taken BEFORE the engine runs, so a genuine double-tap can
 *     never produce two emails; a FAILED send releases the claim so the
 *     broker's deliberate retry actually re-sends.
 *  4. The engine's own suppression / disclosure / quiet-hours gates run
 *     untouched inside the dispatch.
 */
export async function runSendDeliverable<A>(
  input: SendDeliverableInput,
  deps: SendDeliverableDeps<A>,
): Promise<SendDeliverableResult> {
  const kind = input?.kind
  if (!kind || !(DELIVERABLE_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false,
      kind: (kind ?? 'cma') as DeliverableKind,
      personId: Number(input?.personId) || 0,
      error: `Unknown deliverable kind "${String(kind)}"`,
      errorKind: 'bad_input',
    }
  }
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) {
    return fail({ personId: 0, kind }, 'bad_input', 'A valid contact id is required')
  }
  const clientKey = (input.idempotencyKey ?? '').trim()
  if (!clientKey) {
    return fail({ personId, kind }, 'bad_input', 'An idempotency key is required for every send')
  }
  const channel = input.channel ?? 'email'
  if (channel !== 'email' && channel !== 'sms') {
    return fail({ personId, kind }, 'bad_input', `Unsupported channel "${String(channel)}"`)
  }

  const auth = await deps.requireAccess()
  if (!auth.ok) return fail({ personId, kind }, 'auth', auth.error)

  if (!(await deps.personExists(personId))) {
    return fail({ personId, kind }, 'not_found', 'Contact not found')
  }

  const scoped = await deps.requireScope(personId, auth.access)
  if (!scoped.ok) return fail({ personId, kind }, 'auth', scoped.error)

  const normalized: SendDeliverableInput = { ...input, personId, channel, idempotencyKey: clientKey }

  return deps.withIdempotency<SendDeliverableResult>(
    {
      key: deliverableIdempotencyKey(kind, personId, clientKey),
      scope: DELIVERABLE_IDEMPOTENCY_SCOPE,
      onInFlight: {
        ok: false,
        kind,
        personId,
        error: 'That send is already in flight. Give it a few seconds.',
        errorKind: 'in_flight',
      },
    },
    async () => {
      const result = await deps.dispatch[kind](normalized, auth.access)
      if (result.ok) return { ok: true, kind, personId }
      const error = result.error ?? 'Send failed'
      return { ok: false, kind, personId, error, errorKind: classifySendError(error) }
    },
  )
}
