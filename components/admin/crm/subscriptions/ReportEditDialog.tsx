'use client'

/**
 * ReportEditDialog — edits one market-report subscription in the admin
 * Alerts & reports hub through ReportCriteriaEditor, the sentence-style
 * editor ("Send a [monthly] market report for [Bend and Tetherow]") with a
 * live plain-English restatement. Area options load once from the
 * crm_report_areas registry; writes go through updateReportSubscriptionAction,
 * which validates every area key against the registry server-side.
 *
 * P11F: on the LOCKED admin v2 language — the v2 Dialog, av2-rskel rows for
 * the area-registry load, and v2 Buttons. "Save changes" is this file's one
 * primary; Cancel is quiet.
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
import { Button, Dialog } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

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
    <Dialog
      open
      onClose={onClose}
      title="Edit market report subscription"
      size="work"
      description={`${row.personName?.trim() || `Contact #${row.personId}`} gets a report for each selected area.`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || loadState !== 'ready'}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {loadState === 'loading' ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="av2-rskel__row" style={{ height: 32, margin: 0 }} />
            <div className="av2-rskel__row w-2/3" style={{ height: 32, margin: 0 }} />
          </div>
        ) : loadState === 'error' ? (
          <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">Could not load the area list.</p>
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
          <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">{dialogError}</p>
        )}
      </div>
    </Dialog>
  )
}
