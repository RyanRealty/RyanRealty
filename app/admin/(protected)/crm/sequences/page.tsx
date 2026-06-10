// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmSequences, setCrmSequenceStatusAction } from '@/app/actions/crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  if (s.channel === 'sms') return 'SMS (waits on A2P)'
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
        <Link href="/admin/crm" className="hover:text-foreground">← Back to CRM</Link>
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
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    {s.name}
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="ml-2 align-middle">
                      {s.status}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                    <span>{s.counts.running} running</span>
                    <span>{s.counts.paused_reply} replied</span>
                    <span>{s.counts.completed} completed</span>
                    <form action={setStatusForm}>
                      <input type="hidden" name="sequenceId" value={s.id} />
                      <input type="hidden" name="status" value={s.status === 'active' ? 'paused' : 'active'} />
                      <Button type="submit" size="sm" variant={s.status === 'active' ? 'outline' : 'default'}>
                        {s.status === 'active' ? 'Pause' : 'Activate'}
                      </Button>
                    </form>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {Array.isArray(s.steps) && s.steps.length > 0 && s.steps[0]?.channel ? (
                  <ol className="space-y-1 text-sm">
                    {s.steps.map((st, i) => {
                      day += st.delayDays ?? 0
                      return (
                        <li key={i} className="flex gap-3">
                          <span className="w-16 shrink-0 tabular-nums text-muted-foreground">Day {day}</span>
                          <span className="text-foreground">{stepLabel(st)}</span>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Steps not yet normalized for the engine (imported from FUB raw). Normalize before activating.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </main>
  )
}
