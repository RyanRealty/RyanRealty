'use client'

/**
 * The phone half of the Ledger's reveal (site queue SITE-52).
 *
 * A row with `reveal` shows one line the row's text does not carry — the
 * months-of-supply verdict, a twelve-month run of closes — on hover and on
 * keyboard focus, which CSS handles alone in V3Ledger.css. A phone has neither,
 * so this island gives it TAP-AND-HOLD: press a row for V3_LEDGER_HOLD_MS and
 * its reveal opens in place; the tap that would have followed the row is
 * swallowed once, so a hold never also navigates. A tap anywhere else closes
 * it. Everything else about the row — that it is one link, that it works
 * before hydration — is untouched.
 *
 * The mechanism itself is V3HoldReveal (generalised 2026-09-25 so the monthly
 * report's archive months answer a finger the same way a Ledger row does).
 * This wrapper names the Ledger's item and reveal and keeps the
 * `v3-ledger__hold` wrapper the Ledger's markup and tests expect.
 *
 * Only mounted when at least one row carries a reveal, so a ledger without one
 * ships no client code for this.
 */

import type { ReactNode } from 'react'
import { V3HoldReveal, V3_HOLD_MS } from './V3HoldReveal.client'

/** Long enough to be a hold, short enough that the OS context menu (~500ms) has not fired. */
export const V3_LEDGER_HOLD_MS = V3_HOLD_MS

export function V3LedgerRevealIsland({ children }: { children: ReactNode }) {
  return (
    <V3HoldReveal item=".v3-ledger__item" reveal=".v3-ledger__reveal" className="v3-ledger__hold">
      {children}
    </V3HoldReveal>
  )
}
