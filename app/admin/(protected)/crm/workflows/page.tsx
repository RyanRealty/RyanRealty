// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  getWorkflowBoard,
  approveEnrollmentAction,
  pauseEnrollmentAction,
  resumeEnrollmentAction,
  advanceEnrollmentNowAction,
  dismissEnrollmentAction,
} from '@/app/actions/crm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Workflows | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function approveForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await approveEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Approve failed')}`)
}

async function pauseForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await pauseEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Pause failed')}`)
}

async function resumeForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await resumeEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Resume failed')}`)
}

async function advanceForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await advanceEnrollmentNowAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Advance failed')}`)
}

async function dismissForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await dismissEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Stop failed')}`)
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) {
    const future = -ms
    if (future < 3_600_000) return `in ${Math.ceil(future / 60_000)}m`
    if (future < 86_400_000) return `in ${Math.ceil(future / 3_600_000)}h`
    return `in ${Math.ceil(future / 86_400_000)}d`
  }
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function brokerInitials(broker: string | null): string {
  if (!broker) return '?'
  return broker
    .split(/[-_\s]/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' | 'warning' {
  if (status === 'awaiting_broker') return 'warning'
  if (status === 'running') return 'default'
  return 'secondary'
}

type Enrollment = {
  enrollmentId: number
  personId: number
  personName: string | null
  assignedBroker: string | null
  status: string
  stepIndex: number
  nextRunAt: string | null
}

// One enrollment's interior — shared by the desktop kanban card and the mobile
// stacked list so the action forms aren't duplicated. `compact` keeps the dense
// kanban sizing; the mobile list uses larger, thumb-friendly controls.
function EnrollmentCardBody({ en, compact }: { en: Enrollment; compact?: boolean }) {
  const btnClass = compact ? 'h-6 px-2 text-[11px]' : 'h-10 flex-1 px-3 text-sm'
  const formClass = compact ? undefined : 'flex-1'
  return (
    <>
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/admin/crm/${en.personId}`}
          className={
            compact
              ? 'min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline'
              : 'min-w-0 flex-1 truncate text-base font-semibold text-foreground hover:underline'
          }
        >
          {en.personName ?? `#${en.personId}`}
        </Link>
        <span
          className="ml-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={en.assignedBroker ?? 'unassigned'}
        >
          {brokerInitials(en.assignedBroker)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <Badge variant={statusVariant(en.status)} className="text-[10px]">
          {en.status === 'awaiting_broker' ? 'waiting on you' : en.status.replace('_', ' ')}
        </Badge>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {en.status === 'awaiting_broker'
          ? 'waiting on approval'
          : en.nextRunAt
            ? `next: ${fmtRelative(en.nextRunAt)}`
            : null}
      </div>

      {/* Action row */}
      <div className={compact ? 'mt-2 flex flex-wrap gap-1' : 'mt-3 flex flex-wrap gap-2'}>
        {en.status === 'awaiting_broker' ? (
          <form action={approveForm} className={formClass}>
            <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
            <Button type="submit" size="sm" variant="default" className={btnClass}>
              Approve
            </Button>
          </form>
        ) : null}

        {en.status === 'running' ? (
          <>
            <form action={pauseForm} className={formClass}>
              <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
              <Button type="submit" size="sm" variant="outline" className={btnClass}>
                Pause
              </Button>
            </form>
            <form action={advanceForm} className={formClass}>
              <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
              <Button type="submit" size="sm" variant="outline" className={btnClass}>
                Run next now
              </Button>
            </form>
          </>
        ) : null}

        {(en.status === 'paused' || en.status === 'paused_reply') ? (
          <form action={resumeForm} className={formClass}>
            <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
            <Button type="submit" size="sm" variant="outline" className={btnClass}>
              Resume
            </Button>
          </form>
        ) : null}

        <form action={dismissForm} className={formClass}>
          <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className={cn(btnClass, 'text-muted-foreground')}
          >
            Stop
          </Button>
        </form>
      </div>
    </>
  )
}

export default async function CrmWorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ boardError?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const boardError = sp.boardError ? decodeURIComponent(sp.boardError) : null

  const sequences = await getWorkflowBoard()

  // Summary counts across all sequences
  const allEnrollments = sequences.flatMap((s) => s.enrollments)
  const counts = {
    awaiting_broker: allEnrollments.filter((e) => e.status === 'awaiting_broker').length,
    running: allEnrollments.filter((e) => e.status === 'running').length,
    paused: allEnrollments.filter((e) => e.status === 'paused' || e.status === 'paused_reply').length,
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1">
        <Link
          href="/admin/crm"
          className="inline-flex min-h-[40px] items-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to CRM
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Enrollment board</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Active leads moving through automated sequences. Each column is a workflow step.
          </p>
        </div>
        <Link href="/admin/crm/sequences" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 md:h-8">
            Build workflows
          </Button>
        </Link>
      </div>

      {boardError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{boardError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Summary */}
      <ConsoleSection title="Summary" className="mt-4">
        <p className="text-sm text-muted-foreground">
          Across {sequences.length} active {sequences.length === 1 ? 'sequence' : 'sequences'}:
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-2 sm:grid-cols-none sm:flex sm:flex-wrap sm:items-center sm:gap-4">
          <span className="text-sm tabular-nums text-foreground">
            <span className="font-semibold">{counts.awaiting_broker}</span>{' '}
            <span className="block text-muted-foreground sm:inline">waiting on approval</span>
          </span>
          <span className="text-sm tabular-nums text-foreground">
            <span className="font-semibold">{counts.running}</span>{' '}
            <span className="block text-muted-foreground sm:inline">running</span>
          </span>
          <span className="text-sm tabular-nums text-foreground">
            <span className="font-semibold">{counts.paused}</span>{' '}
            <span className="block text-muted-foreground sm:inline">paused</span>
          </span>
        </div>
      </ConsoleSection>

      {/* Per-sequence board */}
      <div className="mt-8 space-y-10">
        {sequences.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No active sequences. Activate a sequence on the Sequences page to see leads here.
            </CardContent>
          </Card>
        ) : (
          sequences.map((seq) => (
            <section key={seq.sequenceId}>
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <h2 className="text-lg font-semibold text-foreground">{seq.sequenceName}</h2>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {seq.enrollments.length} {seq.enrollments.length === 1 ? 'person' : 'people'} active
                </span>
              </div>

              {seq.enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one is in this workflow yet.</p>
              ) : (
                <>
                  {/* Mobile — stacked cards grouped by step (one column, thumb-friendly) */}
                  <div className="space-y-4 md:hidden">
                    {seq.stepLabels.map((label, stepIdx) => {
                      const stepEnrollments = seq.enrollments.filter((e) => e.stepIndex === stepIdx)
                      if (stepEnrollments.length === 0) return null
                      return (
                        <div key={stepIdx}>
                          <div className="mb-2 truncate text-xs font-medium uppercase text-muted-foreground">
                            {label}
                          </div>
                          <div className="space-y-2">
                            {stepEnrollments.map((en) => (
                              <Card key={en.enrollmentId} className="shadow-none">
                                <CardContent className="px-4 py-3">
                                  <EnrollmentCardBody en={en} />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop — horizontal step board (kanban) */}
                  <div className="hidden overflow-x-auto no-scrollbar pb-2 md:block">
                    <div
                      className="inline-flex min-w-full gap-3"
                      style={{ gridTemplateColumns: `repeat(${seq.stepCount}, minmax(200px, 1fr))` }}
                    >
                      {seq.stepLabels.map((label, stepIdx) => {
                        const stepEnrollments = seq.enrollments.filter((e) => e.stepIndex === stepIdx)
                        return (
                          <div
                            key={stepIdx}
                            className="w-56 shrink-0 rounded-lg border border-border bg-card p-3"
                          >
                            <div className="mb-2 truncate text-xs font-medium uppercase text-muted-foreground">
                              {label}
                            </div>
                            {stepEnrollments.length === 0 ? (
                              <p className="text-xs text-muted-foreground">—</p>
                            ) : (
                              <div className="space-y-2">
                                {stepEnrollments.map((en) => (
                                  <Card key={en.enrollmentId} className="shadow-none">
                                    <CardContent className="px-3 py-2">
                                      <EnrollmentCardBody en={en} compact />
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </section>
          ))
        )}
      </div>
    </main>
  )
}
