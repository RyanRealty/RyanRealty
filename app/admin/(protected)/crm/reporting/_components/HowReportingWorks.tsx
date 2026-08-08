'use client'

/**
 * "How Reporting works" explainer — right-aligned in the reporting sub-nav.
 *
 * 11F: migrated off components/ui Dialog. It first carried its own <dialog>
 * markup; now that the v2 barrel HAS a Dialog primitive (landed with the
 * crm/settings editors) it draws that instead, so there is one dialog
 * implementation in the admin rather than two that drift.
 *
 * The explainer COPY is carried over verbatim: it makes claims about how the
 * numbers are computed, and re-wording it would re-state those claims.
 */
import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button, Dialog } from '@/components/admin/v2'

export function HowReportingWorks() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="quiet"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 28,
          padding: '4px 10px',
          fontSize: 'var(--a-text-sm)',
        }}
      >
        <Info aria-hidden size={14} />
        How Reporting works
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="How Reporting works">
        <p>
          Every report is computed live from the CRM database — the timeline of
          calls, emails, texts and notes, plus tasks, appointments, deals and
          lead records. Results may be cached for up to 10 minutes.
        </p>
        <p>
          Agent Activity counts personal 1:1 communication only. Messages sent
          by automations are excluded, so the numbers reflect real follow-up
          work by each broker.
        </p>
        <p>
          New Leads counts lead-created events inside the selected date range.
          Blue numbers drill through to the people behind the count.
        </p>
        <p className="av2-dialog__quiet">
          Brokers see their own numbers. The account owner sees everyone and
          can filter to any broker. Exports respect the same scope.
        </p>
      </Dialog>
    </>
  )
}
