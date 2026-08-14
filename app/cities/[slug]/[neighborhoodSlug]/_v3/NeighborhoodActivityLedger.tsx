import { v3Text, V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3'

export function NeighborhoodActivityLedger(props: {
  placeName: string
  cityName: string
  scoped: boolean
  rows: readonly [V3LedgerFigureRow, ...V3LedgerFigureRow[]]
  source: string
}) {
  return (
    <V3Ledger
      id="activity"
      eyebrow={v3Text(props.scoped ? `Live · ${props.placeName}` : `Live · ${props.cityName}`)}
      heading={v3Text('Latest market activity')}
      rows={props.rows}
      source={v3Text(props.source)}
      action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
    />
  )
}
