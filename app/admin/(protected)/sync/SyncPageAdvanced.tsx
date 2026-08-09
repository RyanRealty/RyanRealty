'use client'

/**
 * SyncPageAdvanced — disclosure housing the manual / override sync controls.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the open state, the
 * children (SyncSmart, RefreshActivePendingButton, TriggerDeltaSyncButton,
 * SyncSinceDateButton, SyncHistoryButtons), and every string are untouched.
 *
 * Collapsible/CollapsibleTrigger/CollapsibleContent are gone: the v2 barrel has
 * no Collapsible primitive. Same pattern as ListingsCsvExport / ActionCard —
 * React state + a quiet Button carrying aria-expanded/aria-controls, content
 * rendered when open. Card shell → .av2-pane with var(--a-*) tokens.
 */

import { useId, useState } from 'react'
import { Button } from '@/components/admin/v2'
import SyncSmart from './SyncSmart'
import SyncHistoryButtons from './SyncHistoryButtons'
import TriggerDeltaSyncButton from './TriggerDeltaSyncButton'
import SyncSinceDateButton from './SyncSinceDateButton'
import RefreshActivePendingButton from './RefreshActivePendingButton'
import type { SyncStatus } from '@/app/actions/sync-full-cron'

type Props = {
  syncStatus: SyncStatus | null
  runInProgress: boolean
  sparkConfigured: boolean
}

export default function SyncPageAdvanced({
  syncStatus,
  runInProgress,
  sparkConfigured,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div
      className="av2-pane"
      style={{
        gap: 0,
        background: 'var(--a-inset)',
      }}
    >
      <Button
        type="button"
        variant="quiet"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-full"
        style={{
          justifyContent: 'space-between',
          padding: '12px 16px',
          color: 'var(--a-text-2)',
          fontWeight: 500,
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--a-text)' }}>Advanced / override</span>
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {open ? 'Hide' : 'Show'} manual sync controls
        </span>
      </Button>
      {open ? (
        <div
          id={panelId}
          className="space-y-4"
          style={{
            borderTop: '1px solid var(--a-border)',
            padding: '8px 16px 16px',
          }}
        >
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}>
            Use only to pause, resume, or run one-off sync chunks. Background sync runs automatically.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SyncSmart initialStatus={syncStatus} sparkConfigured={sparkConfigured} compact />
            <RefreshActivePendingButton runInProgress={runInProgress} syncPhase={syncStatus?.cursor?.phase ?? null} />
          </div>
          <div>
            <TriggerDeltaSyncButton />
          </div>
          <SyncSinceDateButton />
          <SyncHistoryButtons compact />
        </div>
      ) : null}
    </div>
  )
}
