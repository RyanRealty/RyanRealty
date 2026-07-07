'use client'

/**
 * ReportEditDialog — edits one market-report subscription in the admin
 * Subscriptions hub: the subscribed areas (multi-select over the
 * crm_report_areas registry) and the send cadence. Writes through
 * updateReportSubscriptionAction, which validates every area key against the
 * registry server-side.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getSubscriptionEditOptionsAction,
  updateReportSubscriptionAction,
} from '@/app/actions/subscriptions-admin'
import type { AdminReportSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

function normalizeFrequency(f: string): ReportFrequency {
  const v = f.trim().toLowerCase()
  if (v === 'weekly' || v === 'quarterly') return v
  return 'monthly'
}

export default function ReportEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: AdminReportSubscriptionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [areaOptions, setAreaOptions] = useState<Array<{ key: string, label: string }>>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>(row.areas)
  const [frequency, setFrequency] = useState<ReportFrequency>(normalizeFrequency(row.frequency))
  const [dialogError, setDialogError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getSubscriptionEditOptionsAction()
      if (cancelled) return
      if (!res.data) {
        setLoadState('error')
        return
      }
      // Keep any already-subscribed area visible even if it was deactivated in
      // the registry, so saving never silently drops it.
      const registryAreas = res.data.areas
      const known = new Set(registryAreas.map((a) => a.key))
      const extras = row.areas
        .filter((a) => !known.has(a))
        .map((a) => ({ key: a, label: a }))
      setAreaOptions([...registryAreas, ...extras])
      setLoadState('ready')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleArea = (key: string) => {
    setSelectedAreas((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]))
  }

  function handleSave() {
    if (selectedAreas.length === 0) {
      setDialogError('Pick at least one area.')
      return
    }
    setDialogError('')
    startTransition(async () => {
      const res = await updateReportSubscriptionAction(row.personId, {
        areas: selectedAreas,
        frequency,
      })
      if (!res.data) {
        setDialogError(res.error ?? 'Could not save those changes')
        return
      }
      toast.success('Saved the subscription')
      onSaved()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit market report subscription</DialogTitle>
          <DialogDescription>
            {row.personName?.trim() || `Contact #${row.personId}`} gets a report for each selected area.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Areas</Label>
            {loadState === 'loading' ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : loadState === 'error' ? (
              <p className="text-sm text-destructive" role="alert">Could not load the area list.</p>
            ) : (
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                {areaOptions.map((area) => (
                  <Label key={area.key} className="cursor-pointer font-normal">
                    <Checkbox
                      checked={selectedAreas.includes(area.key)}
                      onCheckedChange={() => toggleArea(area.key)}
                      aria-label={area.label}
                    />
                    {area.label}
                  </Label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Cadence</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as ReportFrequency)} disabled={pending}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dialogError && (
            <p className="text-sm text-destructive" role="alert">{dialogError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending || loadState !== 'ready'}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
