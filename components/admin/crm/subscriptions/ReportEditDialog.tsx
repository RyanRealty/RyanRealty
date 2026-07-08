'use client'

/**
 * ReportEditDialog — edits one market-report subscription in the admin
 * Alerts & reports hub through ReportCriteriaEditor, the sentence-style
 * editor ("Send a [monthly] market report for [Bend and Tetherow]") with a
 * live plain-English restatement. Area options load once from the
 * crm_report_areas registry; writes go through updateReportSubscriptionAction,
 * which validates every area key against the registry server-side.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getSubscriptionEditOptionsAction,
  updateReportSubscriptionAction,
} from '@/app/actions/subscriptions-admin'
import type { AdminReportSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import {
  ReportCriteriaEditor,
  type GeoOption,
  type ReportFrequency,
} from '@/components/admin/crm/criteria'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
  const [areaOptions, setAreaOptions] = useState<GeoOption[]>([])
  const [criteria, setCriteria] = useState<{ areas: string[], frequency: ReportFrequency }>({
    areas: row.areas,
    frequency: normalizeFrequency(row.frequency),
  })
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
      const registryAreas = res.data.areas
      setAreaOptions(registryAreas.map((a) => ({ slug: a.key, label: a.label })))
      setLoadState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleSave() {
    if (criteria.areas.length === 0) {
      setDialogError('Pick at least one area.')
      return
    }
    setDialogError('')
    startTransition(async () => {
      const res = await updateReportSubscriptionAction(row.personId, {
        areas: criteria.areas,
        frequency: criteria.frequency,
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
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit market report subscription</DialogTitle>
          <DialogDescription>
            {row.personName?.trim() || `Contact #${row.personId}`} gets a report for each selected area.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {loadState === 'loading' ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : loadState === 'error' ? (
            <p className="text-sm text-destructive" role="alert">Could not load the area list.</p>
          ) : (
            <ReportCriteriaEditor
              areas={criteria.areas}
              frequency={criteria.frequency}
              areaOptions={areaOptions}
              onChange={setCriteria}
              disabled={pending}
            />
          )}

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
