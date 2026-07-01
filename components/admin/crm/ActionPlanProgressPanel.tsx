/**
 * ActionPlanProgressPanel -- shows the contact's live action-plan enrollments
 * with step progress, status, and next-run timing. Mirrors the FUB Action Plans
 * and Automations right-rail sections (spec paragraphs 7c.8.1 and 7c.8.7).
 *
 * Control forms (Pause / Resume / Approve / Stop) follow the same FormData
 * pattern as the rest of the person-detail page. The page creates bound wrapper
 * functions and passes them in as props. Each form includes a hidden enrollmentId.
 *
 * Server component -- no client state needed for display.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ActionPlanEnrollment } from '@/lib/data/crm/getContactActionPlanProgress'

type Props = {
  enrollments: ActionPlanEnrollment[]
  /** Called with FormData containing enrollmentId — triggers pause. */
  pauseAction: (formData: FormData) => Promise<void>
  /** Called with FormData containing enrollmentId -- resumes or approves. */
  resumeAction: (formData: FormData) => Promise<void>
  /** Called with FormData containing enrollmentId -- stops the enrollment. */
  stopAction: (formData: FormData) => Promise<void>
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <Badge className="border-success/20 bg-success/10 text-[10px] text-success">
        Running
      </Badge>
    )
  }
  if (status === 'paused' || status === 'paused_reply') {
    return <Badge variant="outline" className="text-[10px]">Paused</Badge>
  }
  if (status === 'awaiting_broker' || status === 'awaiting_broker_next') {
    return (
      <Badge className="border-warning/20 bg-warning/10 text-[10px] text-warning">
        Awaiting review
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {status}
    </Badge>
  )
}

function fmtNextRun(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = d.getTime() - Date.now()
  if (diff < 0) return 'running now'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.round(diff / 3600000)
  if (hrs < 24) return `in ${hrs}h`
  return `in ${Math.round(hrs / 24)}d`
}

export function ActionPlanProgressPanel({
  enrollments,
  pauseAction,
  resumeAction,
  stopAction,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Action plans{' '}
          {enrollments.length > 0 ? (
            <span className="font-normal text-muted-foreground">
              ({enrollments.length} active)
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No action plans running. Enroll this contact via the Workflow chip above.
          </p>
        ) : (
          enrollments.map((e) => {
            const pct =
              e.totalSteps > 0
                ? Math.round((e.stepIndex / e.totalSteps) * 100)
                : 0
            const nextLabel = fmtNextRun(e.nextRunAt)
            const isRunning = e.status === 'running'
            const isPaused = e.status === 'paused' || e.status === 'paused_reply'
            const isAwaiting =
              e.status === 'awaiting_broker' || e.status === 'awaiting_broker_next'

            return (
              <div
                key={e.enrollmentId}
                className="space-y-2 rounded-lg border border-border px-3 py-2.5"
              >
                {/* Plan name + status + progress label */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {e.sequenceName}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={e.status} />
                      {e.totalSteps > 0 ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          Step {Math.min(e.stepIndex + 1, e.totalSteps)} of {e.totalSteps}
                        </span>
                      ) : null}
                      {nextLabel ? (
                        <span className="text-xs text-muted-foreground">
                          &middot; {nextLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {e.totalSteps > 0 ? (
                  <Progress value={pct} className="h-1.5" />
                ) : null}

                {/* Controls */}
                <div className="flex gap-2">
                  {isRunning ? (
                    <form action={pauseAction}>
                      <input type="hidden" name="enrollmentId" value={e.enrollmentId} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] text-xs sm:min-h-0"
                      >
                        Pause
                      </Button>
                    </form>
                  ) : null}

                  {isPaused ? (
                    <form action={resumeAction}>
                      <input type="hidden" name="enrollmentId" value={e.enrollmentId} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] text-xs sm:min-h-0"
                      >
                        Resume
                      </Button>
                    </form>
                  ) : null}

                  {isAwaiting ? (
                    <form action={resumeAction}>
                      <input type="hidden" name="enrollmentId" value={e.enrollmentId} />
                      <Button
                        type="submit"
                        size="sm"
                        className="min-h-[36px] text-xs sm:min-h-0"
                      >
                        Approve
                      </Button>
                    </form>
                  ) : null}

                  <form action={stopAction}>
                    <input type="hidden" name="enrollmentId" value={e.enrollmentId} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="min-h-[36px] text-xs text-muted-foreground hover:text-destructive sm:min-h-0"
                    >
                      Stop
                    </Button>
                  </form>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
