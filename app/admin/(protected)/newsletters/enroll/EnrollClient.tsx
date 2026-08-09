'use client'

/**
 * EnrollClient — the two-step cohort-enrollment runner mounted by ./page.tsx.
 *
 * 11F: taken off shadcn (Button/Input/Label/Badge/Alert/Table) and onto the
 * LOCKED admin v2 language (design_system/admin/ADMIN_UI.md). Presentation
 * only: runCohortEnrollment, the dry-run-then-typed-confirmation flow, the
 * ENROLL comparison, every count, every error string and router.refresh() are
 * unchanged. The page around it was already on v2.
 *
 * Notes on the swaps, since each one had a choice in it:
 *  - The two alerts become bordered wash blocks on the danger / ok tokens and
 *    keep role="alert", which is what shadcn's Alert carried. Text-plus-colour,
 *    never colour alone (WCAG 1.4.1, ADMIN_UI §3).
 *  - Label + Input become one TextField: the primitive owns the input element
 *    and generates the id its own <label htmlFor> points at, so the explicit
 *    id="enroll-confirm" is gone with the hand-written label. Nothing under
 *    __tests__/ or scripts/ pinned that id — checked before deleting it.
 *  - The sample table becomes ReportGrid, the admin's one tabular reader: it
 *    owns the sideways scroll and the hairlines the wrapper div used to draw.
 *    Read-only cells with no per-row state, so the component itself applies
 *    here rather than ConfigTableEditor's hand-rolled grid.
 *  - A cohort name is DATA, so it renders as an av2-chip, never a StateWord
 *    (which uppercases and is reserved for status words).
 *  - Exactly one primary button is on screen at a time, as before: the dry-run
 *    button de-emphasizes to quiet once a dry run has landed, which is the
 *    moment the real-run button appears.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  runCohortEnrollment,
  type CohortEnrollmentResult,
  type CohortEnrollmentCounts,
  type CohortSizes,
  type CohortSample,
} from '@/app/actions/newsletter-enrollment'
import { Button, ReportGrid, TextField } from '@/components/admin/v2'

const ERROR_COPY: Record<string, string> = {
  unauthorized: 'Only the account owner can run cohort enrollment.',
  audience_build_failed: 'Could not build the audience. Nothing was written. Try again.',
  lookup_failed: 'Could not verify existing subscribers. Nothing was written. Try again.',
  persist_failed: 'Could not save the new subscribers. Check the list before retrying.',
  confirmation_required: 'Type ENROLL to confirm the real run.',
}

type DryRunState = { counts: CohortEnrollmentCounts; cohortSizes: CohortSizes; sample: CohortSample[] }

function CountRow({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'skip' }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ border: '1px solid var(--a-border)' }}
    >
      <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontSize: 'var(--a-text-sm)',
          fontWeight: 600,
          // 'skip' reads as ordinary text, exactly as it did before — only the
          // eligible count is lifted to the ok token.
          color: tone === 'ok' ? 'var(--a-ok)' : 'var(--a-text)',
        }}
      >
        {value.toLocaleString('en-US')}
      </span>
    </div>
  )
}

/** Shared shell for the two result banners. Wash + hairline, never colour alone. */
function Banner({
  tone,
  title,
  children,
}: {
  tone: 'ok' | 'danger'
  title: string
  children: React.ReactNode
}) {
  const line = tone === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)'
  const wash = tone === 'ok' ? 'var(--a-ok-wash)' : 'var(--a-danger-wash)'
  return (
    <div
      role="alert"
      style={{
        border: `1px solid ${line}`,
        background: wash,
        borderRadius: 'var(--a-r-md)',
        padding: '10px 12px',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 600, color: line }}>
        {title}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
        {children}
      </p>
    </div>
  )
}

/**
 * Two-step runner: dry run (counts + 25-person sample, writes nothing), then a
 * typed-confirmation real run. The server action re-enforces both the
 * superuser gate and the typed confirmation.
 */
export function EnrollClient() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dryRun, setDryRun] = useState<DryRunState | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleResult(result: CohortEnrollmentResult) {
    if (result.ok === false) {
      setError(ERROR_COPY[result.error] ?? 'Something went wrong. Nothing was written.')
      return
    }
    setError(null)
    if (result.dryRun) {
      setDryRun({ counts: result.counts, cohortSizes: result.cohortSizes, sample: result.sample })
      setEnrolledCount(null)
      setConfirmText('')
    } else {
      setEnrolledCount(result.enrolled)
      setDryRun(null)
      setConfirmText('')
      router.refresh()
    }
  }

  function runDry() {
    startTransition(async () => {
      handleResult(await runCohortEnrollment({ dryRun: true }))
    })
  }

  function runReal() {
    startTransition(async () => {
      handleResult(await runCohortEnrollment({ dryRun: false, confirmText }))
    })
  }

  const confirmed = confirmText.trim() === 'ENROLL'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runDry} disabled={pending} variant={dryRun ? 'quiet' : 'primary'}>
          {pending && dryRun === null ? 'Running dry run…' : 'Run dry run'}
        </Button>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          A dry run reads the audience and writes nothing.
        </p>
      </div>

      {error ? (
        <Banner tone="danger" title="Enrollment stopped">
          {error}
        </Banner>
      ) : null}

      {enrolledCount !== null ? (
        <Banner tone="ok" title="Enrollment complete">
          <span className="tabular-nums">{enrolledCount.toLocaleString('en-US')}</span> people were added as
          active subscribers. No issue was sent. They will receive the next issue you approve.
        </Banner>
      ) : null}

      {dryRun ? (
        <div className="space-y-4">
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
              Cohorts found
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <CountRow label="Past clients" value={dryRun.cohortSizes.pastClient} />
              <CountRow label="Engaged (180 days)" value={dryRun.cohortSizes.engaged} />
              <CountRow label="Westside cohort" value={dryRun.cohortSizes.westside} />
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
              After the four filters
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <CountRow label="Unique candidates" value={dryRun.counts.candidates} />
              <CountRow label="Would enroll" value={dryRun.counts.eligible} tone="ok" />
              <CountRow label="No email on file" value={dryRun.counts.noEmail} tone="skip" />
              <CountRow label="Realtors excluded" value={dryRun.counts.realtorExcluded} tone="skip" />
              <CountRow label="Suppressed" value={dryRun.counts.suppressed} tone="skip" />
              <CountRow label="Already subscribed" value={dryRun.counts.alreadySubscribed} tone="skip" />
              <CountRow label="Prior opt-out (never re-added)" value={dryRun.counts.optedOut} tone="skip" />
              {dryRun.counts.droppedOverCap > 0 ? (
                <CountRow label="Dropped over the 20,000 cap" value={dryRun.counts.droppedOverCap} tone="skip" />
              ) : null}
            </div>
          </div>

          {dryRun.sample.length > 0 ? (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
                Sample of who would enroll{' '}
                <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}>(first 25)</span>
              </p>
              <ReportGrid
                label="Sample of who would enroll"
                columns={[
                  { key: 'email', label: 'Email' },
                  { key: 'name', label: 'Name' },
                  { key: 'cohorts', label: 'Cohorts' },
                ]}
                template="minmax(200px, 1.6fr) minmax(120px, 1fr) minmax(140px, 1.2fr)"
                minWidth={520}
                rows={dryRun.sample.map((s) => ({
                  key: s.email,
                  cells: [
                    s.email,
                    s.name ?? '—',
                    <span key="cohorts" className="flex flex-wrap gap-1">
                      {s.cohorts.map((c) => (
                        <span
                          key={c}
                          className="av2-chip"
                          style={{ cursor: 'default', fontSize: 'var(--a-text-xs)' }}
                        >
                          {c}
                        </span>
                      ))}
                    </span>,
                  ],
                }))}
                // Unreachable: the branch above owns the empty state so the
                // heading does not render over an empty grid. Kept honest
                // rather than blank, since the prop is required.
                empty="Nobody new to enroll. Everyone eligible is already on the list."
              />
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              Nobody new to enroll. Everyone eligible is already on the list.
            </p>
          )}

          {dryRun.counts.eligible > 0 ? (
            <div className="space-y-2 rounded-lg p-4" style={{ border: '1px solid var(--a-border)' }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
                Real run
              </p>
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                This adds{' '}
                <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                  {dryRun.counts.eligible.toLocaleString('en-US')}
                </span>{' '}
                people as active subscribers. It sends nothing. Type ENROLL to confirm.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <TextField
                    label="Confirmation"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ENROLL"
                    autoComplete="off"
                  />
                </div>
                <Button onClick={runReal} disabled={pending || confirmed === false}>
                  {pending ? 'Enrolling…' : 'Enroll the audience'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
