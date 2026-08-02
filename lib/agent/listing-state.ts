/**
 * lib/agent/listing-state.ts — deterministic listing-state inference (R2.9).
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md, Amendment 1, R2.9:
 * "smart enough to say coming soon or just listed" is a signal TABLE, not
 * vibes. This module is pure (no Supabase, no fetch) so it is exhaustively
 * unit-testable — every row of the table below is one test case in
 * lib/agent/listing-state.test.ts. Callers (lib/agent/tools/produce.ts) do the
 * DB reads and pass the raw signals in.
 *
 * | Signal                                          | Inferred state     |
 * |--------------------------------------------------|-------------------|
 * | No listings row for the address + fresh shoot    | pre_market         |
 * | StandardStatus = 'Coming Soon'                   | coming_soon        |
 * | OnMarketDate <= 7 days                           | just_listed        |
 * | Recent price change                              | price_improvement  |
 * | Pending / Active Under Contract                  | under_contract     |
 * | Closed                                           | just_sold          |
 * | Withdrawn / Expired / Canceled                   | dead               |
 * | StandardStatus NULL                              | unknown            |
 *
 * The NULL-status row is deliberately STRICTER than the public site's
 * documented null-pass-through hole (lib/listing-status-public.ts treats a
 * null StandardStatus as publicly displayable / active, an open question
 * flagged 2026-07-21 and NOT changed there). This module never assumes
 * active — a null/empty/unset status always resolves to 'unknown', which
 * gates content production behind an explicit broker confirmation (R3.6).
 */

import { isComingSoonStatus } from '@/lib/listing-status-public'

export type ListingState =
  | 'pre_market'
  | 'coming_soon'
  | 'just_listed'
  | 'price_improvement'
  | 'under_contract'
  | 'just_sold'
  | 'dead'
  | 'active'
  | 'unknown'

export interface ListingStateSignals {
  /** Whether an MLS `listings` row exists for this property at all. */
  hasListingRow: boolean
  /**
   * Only consulted when `hasListingRow` is false: is there material to build
   * from (a property-shoot ingest per R2.7, or the broker has already
   * supplied facts in-thread per R2.10)? Without this, "no row at all" has
   * nothing to confirm-back and resolves to 'unknown' instead of 'pre_market'.
   */
  freshShootAvailable?: boolean
  /**
   * Raw MLS `StandardStatus`. Absent, null, or empty is NEVER treated as
   * active — see module docstring.
   */
  standardStatus?: string | null
  /** Raw MLS `OnMarketDate` (ISO date string or Date). */
  onMarketDate?: string | Date | null
  /**
   * Caller-computed: was there a price reduction within the recency window?
   * The recency math (how "recent" is defined, e.g. against price_drop_count
   * + a timestamp) belongs to the caller — this module stays pure and takes
   * the boolean conclusion, not raw price history.
   */
  recentPriceChange?: boolean
  /** Injectable clock for deterministic tests. Defaults to `new Date()`. */
  now?: Date
}

export interface ListingStateResult {
  state: ListingState
  /** Broker-facing content suggestion string — plain language, no jargon. */
  suggestion: string
}

/** OnMarketDate age, inclusive, that still reads as "just listed." */
const JUST_LISTED_WINDOW_DAYS = 7

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Infer the broker-facing listing state from a deterministic signal table.
 * Never throws — an unparseable date or an unrecognized status token simply
 * falls through to the next, less specific branch rather than crashing a
 * conversation turn.
 */
export function inferListingState(signals: ListingStateSignals): ListingStateResult {
  const now = signals.now ?? new Date()

  // No MLS row at all — either a genuine pre-market property (shoot/facts in
  // hand) or nothing usable yet.
  if (!signals.hasListingRow) {
    if (signals.freshShootAvailable) {
      return {
        state: 'pre_market',
        suggestion:
          "Coming soon or just-listed-at-launch kit? Either way I need you to confirm a signed listing agreement first.",
      }
    }
    return {
      state: 'unknown',
      suggestion:
        "I don't see an MLS listing for this property yet. What's the address, and is there a signed listing agreement?",
    }
  }

  const status = (signals.standardStatus ?? '').trim()

  // NULL/empty StandardStatus is NEVER assumed active — stricter than the
  // site's documented public null-pass-through hole. Ask, don't guess.
  if (!status) {
    return {
      state: 'unknown',
      suggestion:
        "This listing's status isn't set in the MLS feed. I'll hold off on marketing until you confirm it's active.",
    }
  }

  if (isComingSoonStatus(status)) {
    return {
      state: 'coming_soon',
      suggestion:
        'A coming-soon teaser. I need you to confirm a signed listing agreement exists before I produce anything.',
    }
  }

  if (/pending|under\s*contract/i.test(status)) {
    return {
      state: 'under_contract',
      suggestion: 'A "pending" post letting your sphere know it just went under contract.',
    }
  }

  if (/^closed$/i.test(status)) {
    return {
      state: 'just_sold',
      suggestion: 'A just-sold post with the represented-side framing.',
    }
  }

  if (/withdrawn|expired|cancel/i.test(status)) {
    return {
      state: 'dead',
      suggestion:
        'No marketing on a withdrawn/expired/canceled listing. I can route it to the expired-listing workflow instead if it is still relevant.',
    }
  }

  // Active (or an unrecognized on-market status) from here on.
  const onMarketDate = parseDate(signals.onMarketDate)
  if (onMarketDate) {
    const age = daysSince(onMarketDate, now)
    if (age >= 0 && age <= JUST_LISTED_WINDOW_DAYS) {
      return {
        state: 'just_listed',
        suggestion: 'A just-listed kit (flyer + IG post + carousel).',
      }
    }
  }

  if (signals.recentPriceChange) {
    return {
      state: 'price_improvement',
      suggestion: 'A price-improvement post.',
    }
  }

  return {
    state: 'active',
    suggestion: 'Standard content options for an active listing (flyer, IG post, carousel).',
  }
}
