'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  runCohortEnrollment,
  type CohortEnrollmentResult,
  type CohortEnrollmentCounts,
  type CohortSizes,
  type CohortSample,
} from '@/app/actions/newsletter-enrollment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={tone === 'ok' ? 'text-sm font-semibold tabular-nums text-success' : 'text-sm font-semibold tabular-nums text-foreground'}>
        {value.toLocaleString('en-US')}
      </span>
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
        <Button onClick={runDry} disabled={pending} variant={dryRun ? 'outline' : 'default'}>
          {pending && dryRun === null ? 'Running dry run…' : 'Run dry run'}
        </Button>
        <p className="text-xs text-muted-foreground">A dry run reads the audience and writes nothing.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Enrollment stopped</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {enrolledCount !== null ? (
        <Alert>
          <AlertTitle>Enrollment complete</AlertTitle>
          <AlertDescription>
            <span className="tabular-nums">{enrolledCount.toLocaleString('en-US')}</span> people were added as
            active subscribers. No issue was sent. They will receive the next issue you approve.
          </AlertDescription>
        </Alert>
      ) : null}

      {dryRun ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Cohorts found</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <CountRow label="Past clients" value={dryRun.cohortSizes.pastClient} />
              <CountRow label="Engaged (180 days)" value={dryRun.cohortSizes.engaged} />
              <CountRow label="Westside cohort" value={dryRun.cohortSizes.westside} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">After the four filters</p>
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
              <p className="mb-2 text-sm font-semibold text-foreground">
                Sample of who would enroll <span className="font-normal text-muted-foreground">(first 25)</span>
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Cohorts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dryRun.sample.map((s) => (
                      <TableRow key={s.email}>
                        <TableCell className="font-medium">{s.email}</TableCell>
                        <TableCell className="text-muted-foreground">{s.name ?? '—'}</TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            {s.cohorts.map((c) => (
                              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody new to enroll. Everyone eligible is already on the list.</p>
          )}

          {dryRun.counts.eligible > 0 ? (
            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="text-sm font-semibold text-foreground">Real run</p>
              <p className="text-xs text-muted-foreground">
                This adds <span className="tabular-nums font-medium text-foreground">{dryRun.counts.eligible.toLocaleString('en-US')}</span> people
                as active subscribers. It sends nothing. Type ENROLL to confirm.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="enroll-confirm">Confirmation</Label>
                  <Input
                    id="enroll-confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ENROLL"
                    className="w-40"
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
