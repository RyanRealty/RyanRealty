/**
 * Firm closings as the one house row. Lives beside the page so about/page.tsx
 * never mounts a city-stats Ledger (check-publish-months-of-supply).
 */

import { v3Text, V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3'

const SOURCE = v3Text(
  'Closed MLS sales listed by Ryan Realty. Central Oregon zips starting with 977. Recorded ClosePrice.',
)

export function FirmClosings({ rows }: { rows: readonly V3LedgerFigureRow[] }) {
  const [first, ...rest] = rows
  if (!first) return null
  return (
    <V3Ledger
      id="firm-sales"
      eyebrow={v3Text('Ryan Realty · Closings')}
      heading={v3Text('Recent brokerage closings')}
      rows={[first, ...rest]}
      source={SOURCE}
    />
  )
}
