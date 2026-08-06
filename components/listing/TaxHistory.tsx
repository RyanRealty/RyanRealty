'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type TaxRecord = {
  year: number
  assessedValue: number | null
  taxAmount: number | null
  landValue?: number | null
  improvementValue?: number | null
}

type Props = {
  records: TaxRecord[]
  className?: string
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toLocaleString()}`
}

/**
 * TaxHistory — displays multi-year property tax assessment data.
 *
 * Data sources:
 * - Spark listing `details` JSONB (TaxAnnualAmount, TaxAssessedValue)
 * - Public records when available
 *
 * Shows assessed value and tax amount by year in a table format.
 */
export default function TaxHistory({ records, className }: Props) {
  if (!records || records.length === 0) return null

  // Sort by year descending (most recent first)
  const sorted = [...records].sort((a, b) => b.year - a.year)

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Tax history</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Property tax assessments by year
        </p>

        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Year</TableHead>
                <TableHead className="text-xs text-right">Assessed Value</TableHead>
                <TableHead className="text-xs text-right">Tax Amount</TableHead>
                {sorted.some(r => r.landValue != null) && (
                  <TableHead className="text-xs text-right">Land</TableHead>
                )}
                {sorted.some(r => r.improvementValue != null) && (
                  <TableHead className="text-xs text-right">Improvements</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((record) => {
                // Calculate YoY change for assessed value
                const prevYear = sorted.find(r => r.year === record.year - 1)
                const yoyChange = prevYear?.assessedValue && record.assessedValue
                  ? ((record.assessedValue - prevYear.assessedValue) / prevYear.assessedValue) * 100
                  : null

                return (
                  <TableRow key={record.year}>
                    <TableCell className="text-sm font-medium">{record.year}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.assessedValue)}
                      {yoyChange != null && (
                        <span className={`ml-1 text-xs ${yoyChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(record.taxAmount)}</TableCell>
                    {sorted.some(r => r.landValue != null) && (
                      <TableCell className="text-right text-sm">{formatCurrency(record.landValue ?? null)}</TableCell>
                    )}
                    {sorted.some(r => r.improvementValue != null) && (
                      <TableCell className="text-right text-sm">{formatCurrency(record.improvementValue ?? null)}</TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          Tax data from public records. Taxable values may not reflect current market price.
        </p>
      </CardContent>
    </Card>
  )
}
