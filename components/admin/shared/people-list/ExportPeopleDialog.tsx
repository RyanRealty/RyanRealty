'use client'

/**
 * ExportPeopleDialog — the §15 Export Selected People modal
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * "Would you like to export N people?" + the "Export all columns" checkbox
 * (unchecked by default — it controls which FIELDS export, never which
 * contacts) + Cancel / "Yes, export people". Export hits
 * /api/admin/crm/export with the explicit selection (ids=) or the active
 * filter bag, downloading a CSV under the caller's broker scope.
 * DEFERRAL (logged): §15.3 async generation + email-link + owner notification
 * — the in-house export is a direct synchronous download.
 */

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type ExportPeopleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Explicitly selected ids ([] = export the whole active filter). */
  selectedIds: number[]
  /** Count of contacts the export will cover (selection or matching total). */
  count: number
  /** Pre-built export URL for the ACTIVE FILTERS (no ids). */
  filterExportHref: string
}

export default function ExportPeopleDialog({
  open, onOpenChange, selectedIds, count, filterExportHref,
}: ExportPeopleDialogProps) {
  const [allColumns, setAllColumns] = useState(false)

  const href = (() => {
    const url = new URL(filterExportHref, 'https://x.invalid')
    if (selectedIds.length > 0) url.searchParams.set('ids', selectedIds.join(','))
    if (allColumns) url.searchParams.set('all', '1')
    return `${url.pathname}${url.search}`
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Selected People</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-foreground tabular-nums">
            Would you like to export {count.toLocaleString('en-US')} {count === 1 ? 'person' : 'people'}?
          </p>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox checked={allColumns} onCheckedChange={(v) => setAllColumns(v === true)} />
            Export all columns
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="What does export all columns mean?">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">
                  Unchecked: exports only the columns shown on the People screen. Checked: exports the
                  full data set (every email, phone and address, price, timeframe, lender, background
                  and custom fields).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <p className="text-xs text-muted-foreground">
            This will create an export file of your selected people and download it as a CSV.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" asChild>
            <a href={href} download onClick={() => onOpenChange(false)}>Yes, export people</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
