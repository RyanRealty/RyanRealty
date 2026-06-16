// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  getAwaitingApprovals,
  approveEnrollmentAction,
  skipFirstTouchAction,
  dismissEnrollmentAction,
} from '@/app/actions/crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { Textarea } from '@/components/ui/textarea'

export const metadata = { title: 'First-touch approvals | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function approveForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await approveEnrollmentAction(enrollmentId)
  if (!r.ok) console.error('[crm] approveEnrollment failed:', r.error)
}

async function approveEditedForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const body = (formData.get('body') as string | null)?.trim() || null
  const r = await approveEnrollmentAction(enrollmentId, body)
  if (!r.ok) console.error('[crm] approveEnrollmentEdited failed:', r.error)
}

async function skipForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await skipFirstTouchAction(enrollmentId)
  if (!r.ok) console.error('[crm] skipFirstTouch failed:', r.error)
}

async function dismissForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await dismissEnrollmentAction(enrollmentId)
  if (!r.ok) console.error('[crm] dismissEnrollment failed:', r.error)
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export default async function CrmApprovalsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const items = await getAwaitingApprovals()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0">Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">First-touch approvals</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each new lead lands here with its first text prepared. Review, edit if needed, then send
        to start the workflow. New leads auto-enroll and wait here until a broker acts.
      </p>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? (
          <ConsoleSection title="Pending approvals">
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing waiting on you. New leads land here with their first text prepared.
            </p>
          </ConsoleSection>
        ) : (
          items.map((item) => (
            <ConsoleSection
              key={item.enrollmentId}
              title={item.personName ?? `Contact #${item.personId}`}
              action={
                <Link
                  href={`/admin/crm/${item.personId}`}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  View contact
                </Link>
              }
            >
              {/* Metadata */}
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[11px]">{item.sequenceName}</Badge>
                {item.source ? <span>{item.source}</span> : null}
                {item.assignedBroker ? <span>{item.assignedBroker}</span> : null}
                <span className="tabular-nums">{fmtRelative(item.enrolledAt)}</span>
              </div>

              {/* Prepared message preview */}
              {item.preview ? (
                <blockquote className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                  <p className="whitespace-pre-wrap">{item.preview.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.preview.channel} channel</p>
                </blockquote>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No message step first — task or email opens this workflow.
                </p>
              )}

              {/* CMA link */}
              <div className="mt-3">
                {item.cmaLink ? (
                  <a
                    href={item.cmaLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center text-sm text-foreground underline hover:text-muted-foreground md:min-h-0"
                  >
                    View CMA
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">CMA builds before the text can send.</p>
                )}
              </div>

              {/* Primary actions — stack full-width on phones, inline row from sm up */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <form action={approveForm} className="w-full sm:w-auto">
                  <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                  <Button type="submit" size="sm" className="h-10 w-full sm:h-7 sm:w-auto">Send and start</Button>
                </form>
                <form action={skipForm} className="w-full sm:w-auto">
                  <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                  <Button type="submit" size="sm" variant="outline" className="h-10 w-full sm:h-7 sm:w-auto">Skip first text</Button>
                </form>
                <form action={dismissForm} className="w-full sm:w-auto">
                  <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                  <Button type="submit" size="sm" variant="outline" className="h-10 w-full sm:h-7 sm:w-auto">Dismiss</Button>
                </form>
              </div>

              {/* Edit text disclosure */}
              {item.preview ? (
                <details className="mt-3 rounded-md border border-border">
                  <summary className="flex min-h-10 cursor-pointer items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:min-h-0">
                    Edit text before sending
                  </summary>
                  <div className="border-t border-border px-3 pb-3 pt-3">
                    <form action={approveEditedForm} className="space-y-2">
                      <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                      <Textarea
                        name="body"
                        rows={5}
                        defaultValue={item.preview.body.replace('[CMA link attaches when built]', '%cma_link%')}
                        className="w-full text-sm"
                      />
                      <div className="flex">
                        <Button type="submit" size="sm" className="h-10 w-full sm:h-7 sm:w-auto sm:ml-auto">Send edited text</Button>
                      </div>
                    </form>
                  </div>
                </details>
              ) : null}
            </ConsoleSection>
          ))
        )}
      </div>
    </main>
  )
}
