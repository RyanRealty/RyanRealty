/**
 * Broker-entered rent-vs-sell intent on a CMA. Stored as a first line on
 * `cmas.client_notes` so it survives rebuild without a new column.
 */

export const CMA_CLIENT_INTENTS = ['sell', 'rent', 'both'] as const
export type CmaClientIntent = (typeof CMA_CLIENT_INTENTS)[number]

const INTENT_LINE_RE = /^Intent:\s*(sell|rent|both)\s*$/im

export function isCmaClientIntent(value: unknown): value is CmaClientIntent {
  return value === 'sell' || value === 'rent' || value === 'both'
}

export function parseCmaClientIntent(notes: string | null | undefined): CmaClientIntent | null {
  const match = notes?.match(INTENT_LINE_RE)
  const raw = match?.[1]
  return isCmaClientIntent(raw) ? raw : null
}

/** Drop a prior Intent line, then write the new one first when set. */
export function applyCmaClientIntent(
  notes: string | null | undefined,
  intent: CmaClientIntent | null,
): string | null {
  const stripped = (notes ?? '').replace(INTENT_LINE_RE, '').replace(/^\n+|\n+$/g, '').trim()
  if (!intent) return stripped || null
  return stripped ? `Intent: ${intent}\n${stripped}` : `Intent: ${intent}`
}

export function cmaClientIntentLabel(intent: CmaClientIntent): string {
  switch (intent) {
    case 'sell':
      return 'Sell'
    case 'rent':
      return 'Rent'
    case 'both':
      return 'Rent or sell'
    default: {
      const _never: never = intent
      return _never
    }
  }
}
