// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { completeCrmTaskAction, listCrmOpenTasks, type CrmOpenTask } from '@/app/actions/crm'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Tasks | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function completeTaskForm(taskId: number, personId: number | null, formData: FormData): Promise<void> {
  'use server'
  formData.set('taskId', String(taskId))
  if (personId) formData.set('personId', String(personId))
  const r = await completeCrmTaskAction(formData)
  if (!r.ok) console.error('[crm] completeTask failed:', r.error)
}

function fmtDue(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function groupTasks(tasks: CrmOpenTask[]) {
  const now = Date.now()
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const overdue: CrmOpenTask[] = []
  const today: CrmOpenTask[] = []
  const upcoming: CrmOpenTask[] = []
  const someday: CrmOpenTask[] = []
  for (const t of tasks) {
    if (!t.due_at) { someday.push(t); continue }
    const due = new Date(t.due_at).getTime()
    if (due < now) overdue.push(t)
    else if (due <= endOfToday.getTime()) today.push(t)
    else upcoming.push(t)
  }
  return [
    { label: 'Overdue', tasks: overdue, tone: 'text-destructive' },
    { label: 'Today', tasks: today, tone: 'text-warning' },
    { label: 'Upcoming', tasks: upcoming, tone: 'text-foreground' },
    { label: 'No due date', tasks: someday, tone: 'text-muted-foreground' },
  ].filter((g) => g.tasks.length > 0)
}

export default async function CrmTasksPage({ searchParams }: { searchParams: Promise<{ broker?: string }> }) {
  const { broker } = await searchParams
  const tasks = await listCrmOpenTasks(broker || undefined)
  const groups = groupTasks(tasks)

  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} open across the book</p>
        </div>
        {/* Broker filter — single horizontal-scroll strip on phones, wraps on desktop */}
        <div className="-mx-3 flex gap-2 overflow-x-auto no-scrollbar px-3 sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-0">
          <Button asChild size="sm" variant={!broker ? 'default' : 'outline'} className="h-10 shrink-0 sm:h-7">
            <Link href="/admin/crm/tasks">All</Link>
          </Button>
          {CRM_BROKERS.map((b) => (
            <Button key={b} asChild size="sm" variant={broker === b ? 'default' : 'outline'} className="h-10 shrink-0 sm:h-7">
              <Link href={`/admin/crm/tasks?broker=${b}`}>{CRM_BROKER_DISPLAY[b] ?? b}</Link>
            </Button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing open. New tasks land here the moment a lead acts or a follow-up comes due.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${g.tone}`}>
              {g.label} <span className="tabular-nums">({g.tasks.length})</span>
            </h2>
            <div className="space-y-2">
              {g.tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {t.person?.name && t.person_id ? (
                          <Link href={`/admin/crm/${t.person_id}`} className="font-medium text-primary hover:underline">
                            {t.person.name}
                          </Link>
                        ) : null}
                        <span className="tabular-nums">{fmtDue(t.due_at)}</span>
                        {t.type ? <Badge variant="outline" className="text-xs">{t.type}</Badge> : null}
                        {t.assigned_broker ? <span>{CRM_BROKER_DISPLAY[t.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ?? t.assigned_broker}</span> : null}
                      </div>
                    </div>
                    <form action={completeTaskForm.bind(null, t.id, t.person_id)} className="shrink-0">
                      <Button type="submit" size="sm" variant="outline" className="h-10 px-4 sm:h-7 sm:px-2.5">Done</Button>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
