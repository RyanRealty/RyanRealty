// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmSequences, setCrmSequenceStatusAction } from '@/app/actions/crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'

export const metadata = { title: 'Sequences | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function setStatusForm(formData: FormData): Promise<void> {
  'use server'
  const r = await setCrmSequenceStatusAction(formData)
  if (!r.ok) console.error('[crm] setSequenceStatus failed:', r.error)
}

function stepLabel(s: { channel: string; templateKey?: string; taskName?: string; addTags?: string[]; removeTags?: string[] }): string {
  if (s.channel === 'email') return `Email · ${(s.templateKey ?? '').replace(/^email-/, '').replace(/-\d+$/, '')}`
  if (s.channel === 'task') return `Task · ${s.taskName ?? ''}`
  if (s.channel === 'sms') return 'SMS'
  if (s.channel === 'tag') return `Tags · ${[...(s.removeTags ?? []).map((t) => `-${t}`), ...(s.addTags ?? []).map((t) => `+${t}`)].join(' ')}`
  return s.channel
}

export default async function CrmSequencesPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const sequences = await listCrmSequences()

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0">← Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Sequences</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Automated workflows. New leads auto-enroll by intent (expired, FSBO, seller, buyer). Active sequences send
        emails from the assigned broker&apos;s own mailbox inside 7am–7pm PT, pause on any reply, and never touch a
        suppressed contact. Pausing a sequence holds every enrollment in place.
      </p>

      <div className="mt-6 space-y-4">
        {sequences.map((s) => {
          let day = 0
          return (
            <ConsoleSection
              key={s.id}
              title={s.name}
              count={s.status === 'active' ? '(active)' : '(paused)'}
              action={
                <form action={setStatusForm}>
                  <input type="hidden" name="sequenceId" value={s.id} />
                  <input type="hidden" name="status" value={s.status === 'active' ? 'paused' : 'active'} />
                  <Button type="submit" size="sm" variant={s.status === 'active' ? 'outline' : 'default'} className="min-h-10 md:min-h-0">
                    {s.status === 'active' ? 'Pause' : 'Activate'}
                  </Button>
                </form>
              }
            >
              <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span>{s.counts.running} running</span>
                <span>{s.counts.paused_reply} replied</span>
                <span>{s.counts.completed} completed</span>
              </div>
              {Array.isArray(s.steps) && s.steps.length > 0 && s.steps[0]?.channel ? (
                <ol className="space-y-1 text-sm">
                  {s.steps.map((st, i) => {
                    day += st.delayDays ?? 0
                    return (
                      <li key={i} className="flex gap-3">
                        <span className="w-16 shrink-0 tabular-nums text-muted-foreground">Day {day}</span>
                        <span className="min-w-0 break-words text-foreground">{stepLabel(st)}</span>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Steps not yet normalized for the engine (imported from FUB raw). Normalize before activating.
                </p>
              )}
            </ConsoleSection>
          )
        })}
      </div>
    </main>
  )
}
