'use client'

import { useTransition, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { updateCrmDeal, addDealSplit, removeDealSplit } from '@/app/actions/crm-deals'
import type { CrmDealSplit } from '@/lib/data/crm/getCrmDeal'

const BROKER_SLUGS = ['matt', 'paul', 'rebecca']

type Props = {
  dealId: number
  initialCommissionDollars: number | null
  initialCommissionPercent: number | null
  splits: CrmDealSplit[]
}

export function DealCommission({
  dealId,
  initialCommissionDollars,
  initialCommissionPercent,
  splits,
}: Props) {
  const [dollars, setDollars] = useState(
    initialCommissionDollars != null ? String(initialCommissionDollars) : '',
  )
  const [pct, setPct] = useState(
    initialCommissionPercent != null ? String(initialCommissionPercent) : '',
  )
  const [gciError, setGciError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Add split form state
  const [newSlug, setNewSlug] = useState(BROKER_SLUGS[0])
  const [newPct, setNewPct] = useState('100')
  const [newDollars, setNewDollars] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [splitError, setSplitError] = useState<string | null>(null)

  function saveGci(field: 'dollars' | 'pct') {
    startTransition(async () => {
      const patch =
        field === 'dollars'
          ? { commission_dollars: dollars ? Number(dollars) : null }
          : { commission_percent: pct ? Number(pct) : null }
      const res = await updateCrmDeal(dealId, patch)
      if (!res.ok) setGciError(res.error)
      else setGciError(null)
    })
  }

  function handleAddSplit() {
    setSplitError(null)
    const pctNum = Number(newPct)
    if (!newPct.trim() || isNaN(pctNum) || pctNum <= 0 || pctNum > 100) {
      setSplitError('Split % must be between 0 and 100')
      return
    }
    startTransition(async () => {
      const res = await addDealSplit(dealId, {
        broker_slug: newSlug,
        split_pct: pctNum,
        split_dollars: newDollars ? Number(newDollars) : null,
        notes: newNotes || null,
      })
      if (!res.ok) {
        setSplitError(res.error)
      } else {
        setNewPct('100')
        setNewDollars('')
        setNewNotes('')
      }
    })
  }

  function handleRemoveSplit(splitId: number) {
    startTransition(async () => {
      await removeDealSplit(dealId, splitId)
    })
  }

  return (
    <div className="space-y-5">
      {/* GCI fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="comm-dollars" className="text-xs text-muted-foreground">
            GCI ($)
          </Label>
          <Input
            id="comm-dollars"
            type="number"
            min="0"
            step="100"
            value={dollars}
            disabled={isPending}
            onChange={(e) => setDollars(e.target.value)}
            onBlur={() => saveGci('dollars')}
            placeholder="e.g. 18000"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="comm-pct" className="text-xs text-muted-foreground">
            Commission (%)
          </Label>
          <Input
            id="comm-pct"
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={pct}
            disabled={isPending}
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => saveGci('pct')}
            placeholder="e.g. 3.0"
            className="h-8 text-sm"
          />
        </div>
      </div>
      {gciError ? <p className="text-xs text-destructive">{gciError}</p> : null}

      {/* Splits table */}
      {splits.length > 0 ? (
        <div className="no-scrollbar overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Broker</TableHead>
                <TableHead className="text-right text-xs">Split %</TableHead>
                <TableHead className="text-right text-xs">Split $</TableHead>
                <TableHead className="text-xs">Notes</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {splits.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium capitalize text-foreground">{s.broker_slug}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{s.split_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {s.split_dollars != null ? `$${Math.round(s.split_dollars).toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.notes ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleRemoveSplit(s.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove split"
                    >
                      ✕
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No splits yet.</p>
      )}

      {/* Add split form */}
      <details className="group">
        <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">
          + Add split
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Broker</Label>
            <Select value={newSlug} onValueChange={setNewSlug} disabled={isPending}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BROKER_SLUGS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Split %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
              disabled={isPending}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Split $ (opt)</Label>
            <Input
              type="number"
              min="0"
              value={newDollars}
              onChange={(e) => setNewDollars(e.target.value)}
              disabled={isPending}
              placeholder="—"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Notes (opt)</Label>
            <Input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              disabled={isPending}
              placeholder="—"
              className="h-8 text-sm"
            />
          </div>
        </div>
        {splitError ? <p className="mt-1 text-xs text-destructive">{splitError}</p> : null}
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={isPending}
          onClick={handleAddSplit}
        >
          Save split
        </Button>
      </details>
    </div>
  )
}
