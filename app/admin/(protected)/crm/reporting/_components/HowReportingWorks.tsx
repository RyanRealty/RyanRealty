'use client'

/**
 * "How Reporting works" explainer — right-aligned in the reporting sub-nav.
 *
 * 11F: migrated off components/ui Dialog to the platform's <dialog>, which
 * gives the APG dialog behaviours (modal focus trap, Esc to close, inert
 * background) without a component library — §4 requires composites follow APG,
 * and the v2 barrel has no Dialog primitive to reach for.
 *
 * The explainer COPY is carried over verbatim: it makes claims about how the
 * numbers are computed, and re-wording it would re-state those claims.
 */
import '@/components/admin/v2/admin-v2.css'
import { useRef } from 'react'
import { Info } from 'lucide-react'
import { Button, SectionHead } from '@/components/admin/v2'

export function HowReportingWorks() {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <Button
        variant="quiet"
        onClick={() => ref.current?.showModal()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '4px 10px', fontSize: 'var(--a-text-sm)' }}
      >
        <Info aria-hidden size={14} />
        How Reporting works
      </Button>

      <dialog ref={ref} className="av2-dialog" aria-labelledby="how-reporting-title">
        <div className="av2-dialog__head">
          <SectionHead id="how-reporting-title">How Reporting works</SectionHead>
          <Button variant="quiet" onClick={() => ref.current?.close()}>
            Close
          </Button>
        </div>
        <div className="av2-dialog__body">
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
        </div>
      </dialog>
    </>
  )
}
