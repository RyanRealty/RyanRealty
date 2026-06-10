// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  addCrmNoteAction,
  addCrmTagAction,
  addCrmTaskAction,
  assignCrmBrokerAction,
  completeCrmTaskAction,
  getCrmEmailTemplates,
  getCrmPersonFull,
  removeCrmTagAction,
  sendCrmEmailAction,
  updateCrmStageAction,
} from '@/app/actions/crm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

export const metadata = { title: 'Contact | CRM | Admin' }
export const dynamic = 'force-dynamic'

// <form action> requires Promise<void> — discard the structured results here.
// Failures are logged server-side; the page re-renders current state either way.
async function addNoteForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmNoteAction(formData)
  if (!r.ok) console.error('[crm] addNote failed:', r.error)
}
async function updateStageForm(formData: FormData): Promise<void> {
  'use server'
  const r = await updateCrmStageAction(formData)
  if (!r.ok) console.error('[crm] updateStage failed:', r.error)
}
async function addTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTagAction(formData)
  if (!r.ok) console.error('[crm] addTag failed:', r.error)
}
async function removeTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await removeCrmTagAction(formData)
  if (!r.ok) console.error('[crm] removeTag failed:', r.error)
}
async function addTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTaskAction(formData)
  if (!r.ok) console.error('[crm] addTask failed:', r.error)
}
async function completeTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await completeCrmTaskAction(formData)
  if (!r.ok) console.error('[crm] completeTask failed:', r.error)
}
async function assignBrokerForm(formData: FormData): Promise<void> {
  'use server'
  const r = await assignCrmBrokerAction(formData)
  if (!r.ok) console.error('[crm] assignBroker failed:', r.error)
}
async function sendEmailForm(formData: FormData): Promise<void> {
  'use server'
  const r = await sendCrmEmailAction(formData)
  if (!r.ok) console.error('[crm] sendEmail failed:', r.error)
}

const KIND_ICON: Record<string, string> = {
  note: '📝', email_in: '📥', email_out: '📤', sms_in: '💬', sms_out: '📲',
  call: '📞', voicemail: '🎙', web_event: '🌐', task: '☑', stage_change: '🪜', system: '⚙',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function fmtPhoneDisplay(tenDigits: string): string {
  if (tenDigits.length !== 10) return tenDigits
  return `${tenDigits.slice(0, 3)}.${tenDigits.slice(3, 6)}.${tenDigits.slice(6)}`
}

export default async function CrmPersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tpl?: string }> }) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')

  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const { tpl } = await searchParams
  const full = await getCrmPersonFull(id)
  const person = full.person
  if (!person) notFound()
  const templates = await getCrmEmailTemplates()
  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null

  const customEntries = Object.entries(person.custom ?? {}).filter(
    ([, v]) => v !== null && v !== '' && v !== undefined,
  )
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const doneTasks = full.tasks.filter((t) => t.completed_at)
  const geo = full.geo as { city?: string; neighborhood?: string; subdivision?: string } | null

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-foreground">← Back to CRM</Link>
      </div>

      {full.suppressions.length > 0 ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Contact restrictions active</AlertTitle>
          <AlertDescription>
            {full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' · ')}. Automated outreach is blocked for the listed channels.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* ── Left: identity ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{person.name ?? `Contact #${person.id}`}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {person.source ?? 'Unknown source'} · created {fmtDateTime(person.fub_created_at)}
                  </p>
                </div>
                {person.fub_legacy_id ? (
                  <a
                    href={`https://ryan-realty.followupboss.com/2/people/view/${person.fub_legacy_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Open in FUB ↗
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stage */}
              <form action={updateStageForm} className="flex items-center gap-2">
                <input type="hidden" name="personId" value={person.id} />
                <select
                  name="stage"
                  defaultValue={person.stage}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {CRM_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">Set stage</Button>
              </form>

              <form action={assignBrokerForm} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="personId" value={person.id} />
                <span className="text-muted-foreground">Broker:</span>
                <select
                  name="broker"
                  defaultValue={person.assigned_broker ?? ''}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {!person.assigned_broker ? <option value="">unassigned</option> : null}
                  {CRM_BROKERS.map((b) => (
                    <option key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">Assign</Button>
              </form>

              <Separator />

              {/* Contact points */}
              <div className="space-y-1.5">
                {full.contactPoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contact info on file.</p>
                ) : (
                  full.contactPoints.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between text-sm">
                      <a
                        href={cp.kind === 'email' ? `mailto:${cp.value}` : `tel:+1${cp.value}`}
                        className="text-foreground hover:underline"
                      >
                        {cp.kind === 'phone' ? fmtPhoneDisplay(cp.value) : cp.value}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {cp.label ?? cp.kind}{cp.is_primary ? ' · primary' : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {person.tags.map((t) => (
                    <form key={t} action={removeTagForm} className="inline-flex">
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="tag" value={t} />
                      <Badge variant="outline" className="gap-1 pr-1 text-[11px]">
                        {t}
                        <button type="submit" aria-label={`Remove ${t}`} className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
                      </Badge>
                    </form>
                  ))}
                </div>
                <form action={addTagForm} className="mt-2 flex gap-2">
                  <input type="hidden" name="personId" value={person.id} />
                  <Input name="tag" placeholder="add-tag" className="h-8 text-sm" />
                  <Button type="submit" size="sm" variant="outline">Add</Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Linked intel — the stuff FUB can't show */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Platform intel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {geo && (geo.city || geo.neighborhood || geo.subdivision) ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geo</span>
                  <span className="text-right text-foreground">
                    {[geo.subdivision, geo.neighborhood, geo.city].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Website sessions</span>
                <span className="tabular-nums text-foreground">{full.visitorSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CMA deliveries</span>
                <span className="tabular-nums text-foreground">{full.cmaDeliveries.length}</span>
              </div>
              {full.enrollments.length > 0 ? (
                <div>
                  <div className="mb-1 text-muted-foreground">Sequences</div>
                  {full.enrollments.map((e) => (
                    <div key={e.id} className="flex justify-between">
                      <span className="text-foreground">{e.crm_sequences?.name ?? `Sequence`}</span>
                      <Badge variant="outline" className="text-[11px]">{e.status} · step {e.step_index}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Custom fields */}
          {customEntries.length > 0 ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Fields ({customEntries.length})</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-1.5 text-sm">
                  {customEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">{k.replace(/^custom/, '')}</dt>
                      <dd className="truncate text-right text-foreground">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {person.background ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Background</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm text-foreground">{person.background}</p></CardContent>
            </Card>
          ) : null}
        </div>

        {/* ── Right: tasks + timeline ── */}
        <div className="space-y-6">
          {/* Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tasks ({openTasks.length} open)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.type ?? 'Task'} · due {fmtDateTime(t.due_at)}
                    </div>
                  </div>
                  <form action={completeTaskForm}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <Button type="submit" size="sm" variant="outline">Done</Button>
                  </form>
                </div>
              ))}
              {doneTasks.length > 0 ? (
                <p className="text-xs text-muted-foreground">{doneTasks.length} completed</p>
              ) : null}
              <form action={addTaskForm} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="personId" value={person.id} />
                <Input name="name" placeholder="New task" className="h-8 w-56 text-sm" />
                <select name="type" className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" defaultValue="Follow Up">
                  {['Follow Up', 'Call', 'Text', 'Email'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="dueHours" className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" defaultValue="24">
                  <option value="1">in 1 hour</option>
                  <option value="4">in 4 hours</option>
                  <option value="24">tomorrow</option>
                  <option value="72">in 3 days</option>
                  <option value="168">in a week</option>
                </select>
                <Button type="submit" size="sm" variant="outline">Add task</Button>
              </form>
            </CardContent>
          </Card>

          {/* Email composer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Send email {primaryEmail ? <span className="font-normal text-muted-foreground">to {primaryEmail}</span> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryEmail ? (
                <>
                  <form method="GET" className="flex items-center gap-2">
                    <select name="tpl" defaultValue={tpl ?? ''} className="h-8 max-w-[360px] flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                      <option value="">Blank email</option>
                      {templates.map((t) => (
                        <option key={t.key} value={t.key}>{t.name}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Load template</Button>
                  </form>
                  <form action={sendEmailForm} className="space-y-2">
                    <input type="hidden" name="personId" value={person.id} />
                    <Input name="subject" placeholder="Subject" defaultValue={activeTpl?.subject ?? ''} />
                    <Textarea name="body" rows={5} placeholder="Message — sends from the signed-in broker's own mailbox" defaultValue={activeTpl?.body ?? ''} />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm">Send email</Button>
                    </div>
                  </form>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No email address on file.</p>
              )}
            </CardContent>
          </Card>

          {/* Composer */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Add note</CardTitle></CardHeader>
            <CardContent>
              <form action={addNoteForm} className="space-y-2">
                <input type="hidden" name="personId" value={person.id} />
                <Textarea name="body" placeholder="Note — writes to the CRM timeline and to FUB while the parallel run is on" rows={3} />
                <div className="flex justify-end">
                  <Button type="submit" size="sm">Save note</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Timeline <span className="font-normal text-muted-foreground">({full.timelineTotal.toLocaleString('en-US')} entries, latest 100)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {full.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  full.timeline.map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="w-6 shrink-0 text-center text-base leading-6">{KIND_ICON[e.kind] ?? '•'}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-foreground">{e.title ?? e.kind.replace('_', ' ')}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(e.ts)}</span>
                          {e.broker ? <Badge variant="outline" className="text-[10px]">{e.broker}</Badge> : null}
                        </div>
                        {e.body ? (
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {((e.payload as { isHtml?: boolean })?.isHtml ? stripHtml(e.body) : e.body).slice(0, 1200)}
                          </p>
                        ) : null}
                        {(e.payload as { recordingSid?: string })?.recordingSid ? (
                          <audio
                            controls
                            preload="none"
                            className="mt-1.5 h-9 w-full max-w-md"
                            src={`/api/admin/crm/recording/${(e.payload as { recordingSid: string }).recordingSid}`}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
