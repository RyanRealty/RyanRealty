'use client'

/**
 * PersonRightRail — §7c.8 right action rail of the person-detail three-column
 * layout (spec docs/fub-crm-spec/07c-person-detail-compose-modals-and-right-
 * rail.md). Light-muted background, independently scrollable.
 *
 * Top metadata strip (§07b 13) → widgets in documented order: Action Plans ·
 * Activity ("Seen X ago") · Tasks (N) · Appointments · Deals · Automations ·
 * Files (+ = Upload File(s) / Add Link dropdown, drag-drop target) ·
 * Collaborators → keyboard-shortcut hint pinned at the bottom.
 *
 * Collapse state persists per user (localStorage). Drag-reorder of widgets is
 * a logged deferral. The AgentFire FUB Widget section is FUB-specific
 * third-party embed and is intentionally not reproduced (logged decision).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Play,
  Footprints,
  ListChecks,
  Calendar,
  Briefcase,
  Paperclip,
  Users,
  Trash2,
  Zap,
  Pause,
  Square,
  Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ApplyAutomationDialog } from './PersonDialogs'
import {
  addPersonFileLinkAction,
  uploadPersonFileAction,
  deletePersonFileAction,
} from '@/app/actions/crm-person-files'
import { quickFollowUpAction } from '@/app/actions/crm-person-detail'
import {
  addCrmTaskAction,
  completeCrmTaskAction,
  pauseEnrollmentAction,
  resumeEnrollmentAction,
  dismissEnrollmentAction,
} from '@/app/actions/crm'
import { addCrmCollaboratorAction, removeCrmCollaboratorAction } from '@/app/actions/crm-person-gaps'
import type { PersonAppointment, PersonDeal, PersonFile } from '@/lib/data/crm/getPersonDetailExtras'

export type RailEnrollment = {
  enrollmentId: number
  sequenceName: string
  stepIndex: number
  totalSteps: number
  status: string
  enrolledAt: string
}
export type RailTask = { id: number; name: string; type: string | null; dueAt: string | null; assignedBroker: string | null }
export type RailCollaborator = { brokerSlug: string; name: string }

/**
 * Client-only clock read (hydration-safe per gate #418): null on the server and
 * the first client render, the real time after mount. Callers render a
 * deterministic absolute fallback until it resolves.
 */
function useClientNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])
  return now
}

function fmtAgo(iso: string | null, nowMs: number | null): string {
  if (!iso) return ''
  // Pre-hydration: a deterministic absolute date (no clock read in render).
  if (nowMs == null) return fmtDate(iso)
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
}
function usd(n: number | null): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function RailSection({
  id,
  icon,
  title,
  headerRight,
  collapsedIndicator,
  defaultOpen = true,
  children,
}: {
  id: string
  icon: React.ReactNode
  title: string
  headerRight?: React.ReactNode
  collapsedIndicator?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const storageKey = `crm.rail.${id}`
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored !== null) setOpen(stored === '1')
  }, [storageKey])
  function toggle(next: boolean) {
    setOpen(next)
    window.localStorage.setItem(storageKey, next ? '1' : '0')
  }
  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        {!open ? collapsedIndicator : null}
        {headerRight}
        <CollapsibleTrigger asChild>
          <button type="button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t border-border px-3 py-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function AddButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" size="icon" variant="default" className="h-6 w-6 rounded-full" {...props}>
      <Plus className="h-3.5 w-3.5" />
    </Button>
  )
}

// ── Collaborators modal (§7c.7) ──────────────────────────────────────────────

function CollaboratorsDialog({
  personId,
  collaborators,
  brokerOptions,
  assignedBroker,
}: {
  personId: number
  collaborators: RailCollaborator[]
  brokerOptions: Array<{ value: string; label: string }>
  assignedBroker: string | null
}) {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()

  const candidates = brokerOptions.filter((b) => b.value !== assignedBroker)
  const visible = candidates.filter((c) => !query.trim() || c.label.toLowerCase().includes(query.trim().toLowerCase()))

  function openDialog(o: boolean) {
    setOpen(o)
    if (o) {
      setChecked(new Set(collaborators.map((c) => c.brokerSlug)))
      setQuery('')
    }
  }
  function save() {
    start(async () => {
      const before = new Set(collaborators.map((c) => c.brokerSlug))
      for (const slug of checked) if (!before.has(slug)) await addCrmCollaboratorAction(personId, slug)
      for (const slug of before) if (!checked.has(slug)) await removeCrmCollaboratorAction(personId, slug)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <AddButton aria-label="Add collaborator" />
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collaborators</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a collaborator" className="h-9 text-sm" />
        <div className="space-y-1">
          {visible.map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-secondary">
              <Checkbox
                checked={checked.has(c.value)}
                onCheckedChange={(v) =>
                  setChecked((prev) => {
                    const next = new Set(prev)
                    if (v === true) next.add(c.value)
                    else next.delete(c.value)
                    return next
                  })
                }
              />
              {c.label}
            </label>
          ))}
          {visible.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">No team members found.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Files widget (§7c.8.8) ───────────────────────────────────────────────────

function FilesSection({ personId, files }: { personId: number; files: PersonFile[] }) {
  const nowMs = useClientNow()
  const [dragOver, setDragOver] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function upload(list: FileList | null) {
    if (!list || list.length === 0) return
    start(async () => {
      for (const file of Array.from(list)) {
        const fd = new FormData()
        fd.set('personId', String(personId))
        fd.set('file', file)
        const r = await uploadPersonFileAction(fd)
        if (!r.ok) {
          setError(r.error)
          return
        }
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <RailSection
      id="files"
      icon={<Paperclip className="h-4 w-4" />}
      title="Files"
      headerRight={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AddButton aria-label="Add file" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>Upload File(s)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLinkOpen(true)}>Add Link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          upload(e.dataTransfer.files)
        }}
        className={cn('space-y-1.5 rounded-md', dragOver && 'border-2 border-dashed border-primary bg-primary/5 p-2')}
      >
        {files.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">No files yet, drag some here</p>
        ) : (
          files.map((f) => (
            <div key={f.id} className="group flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="block truncate text-sm hover:underline">
                    {f.name}
                  </a>
                ) : (
                  <span className="block truncate text-sm">{f.name}</span>
                )}
                <span className="text-xs text-muted-foreground" title={f.uploadedBy ?? undefined}>
                  {f.kind === 'link' ? 'Link' : 'File'} · {fmtAgo(f.createdAt, nowMs)}
                </span>
              </div>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" aria-label={`Download ${f.name}`} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100">
                  <Download className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <button
                type="button"
                aria-label={`Delete ${f.name}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deletePersonFileAction(f.id)
                    router.refresh()
                  })
                }
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
        {pending ? <p className="text-xs text-muted-foreground">Working…</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="h-9 text-sm" />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await addPersonFileLinkAction(personId, linkTitle, linkUrl)
                  if (r.ok) {
                    setLinkOpen(false)
                    setLinkTitle('')
                    setLinkUrl('')
                    setError(null)
                    router.refresh()
                  } else setError(r.error)
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RailSection>
  )
}

// ── The rail ─────────────────────────────────────────────────────────────────

export function PersonRightRail({
  personId,
  metaAddress,
  metaCreatedAt,
  metaAssignedName,
  enrollments,
  automationOptions,
  lastSeenAt,
  activitySummary,
  tasks,
  appointments,
  deals,
  files,
  collaborators,
  brokerOptions,
  assignedBroker,
  homeCardNode,
  websiteActivityNode,
}: {
  personId: number
  metaAddress: string | null
  metaCreatedAt: string | null
  metaAssignedName: string | null
  enrollments: RailEnrollment[]
  automationOptions: Array<{ id: number; name: string }>
  lastSeenAt: string | null
  activitySummary: Array<{ label: string; value: number }>
  tasks: RailTask[]
  appointments: PersonAppointment[]
  deals: PersonDeal[]
  files: PersonFile[]
  collaborators: RailCollaborator[]
  brokerOptions: Array<{ value: string; label: string }>
  assignedBroker: string | null
  /** In-house owned-home / CMA card, rendered under the metadata strip. */
  homeCardNode?: React.ReactNode
  /** §7c.8.5 website-activity slot (our equivalent of FUB's AgentFire widget). */
  websiteActivityNode?: React.ReactNode
}) {
  const [pending, start] = useTransition()
  const [newTask, setNewTask] = useState('')
  const router = useRouter()
  const nowMs = useClientNow()
  const openTasks = tasks.filter((t) => t)
  const runningPlans = enrollments.filter((e) => e.status === 'running')
  // Pre-hydration (nowMs null) shows all appointments; narrows after mount.
  const upcomingAppts = nowMs == null ? appointments : appointments.filter((a) => new Date(a.startAt).getTime() > nowMs)

  function refresh() {
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-muted/40 px-3 py-3">
      {/* Last-lead metadata strip (§07b 13) */}
      {(metaAddress || metaCreatedAt || metaAssignedName) && (
        <div className="mb-3 space-y-0.5 px-1 text-xs text-muted-foreground">
          {metaAddress ? <p className="font-medium text-foreground">{metaAddress}</p> : null}
          {metaCreatedAt ? <p>{fmtDate(metaCreatedAt)}</p> : null}
          {metaAssignedName ? <p>Assigned: {metaAssignedName}</p> : null}
        </div>
      )}
      {homeCardNode ? <div className="mb-2.5">{homeCardNode}</div> : null}

      <div className="space-y-2.5">
        {/* Action Plans (§7c.8.1) */}
        <RailSection
          id="action-plans"
          icon={<Play className="h-4 w-4" />}
          title="Action Plans"
          collapsedIndicator={runningPlans.length > 0 ? <Badge className="bg-success text-[10px] text-success-foreground">{runningPlans.length}</Badge> : null}
          headerRight={
            <ApplyAutomationDialog personId={personId} automations={automationOptions} trigger={<AddButton aria-label="Apply automation" />} />
          }
        >
          {enrollments.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No action plans running</p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => (
                <div key={e.enrollmentId} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{e.sequenceName}</span>
                    <Badge
                      variant={e.status === 'running' ? 'default' : 'secondary'}
                      className={cn('text-[10px] capitalize', e.status === 'running' && 'bg-success text-success-foreground')}
                    >
                      {e.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {Math.min(e.stepIndex, e.totalSteps)} of {e.totalSteps} steps complete · Started {fmtAgo(e.enrolledAt, nowMs)}
                    </span>
                    <span className="flex gap-0.5">
                      {e.status === 'running' ? (
                        <button
                          type="button"
                          aria-label="Pause plan"
                          disabled={pending}
                          onClick={() => start(async () => (await pauseEnrollmentAction(e.enrollmentId), refresh()))}
                          className="rounded p-0.5 hover:text-foreground"
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Resume plan"
                          disabled={pending}
                          onClick={() => start(async () => (await resumeEnrollmentAction(e.enrollmentId), refresh()))}
                          className="rounded p-0.5 hover:text-foreground"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Stop plan"
                        disabled={pending}
                        onClick={() => start(async () => (await dismissEnrollmentAction(e.enrollmentId), refresh()))}
                        className="rounded p-0.5 hover:text-destructive"
                      >
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Activity (§7c.8.2) */}
        <RailSection
          id="activity"
          icon={<Footprints className="h-4 w-4" />}
          title="Activity"
          headerRight={lastSeenAt ? <span className="text-xs text-muted-foreground">Seen {fmtAgo(lastSeenAt, nowMs)}</span> : null}
        >
          <dl className="space-y-1">
            {activitySummary.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </RailSection>

        {/* Tasks (§7c.8.3) */}
        <RailSection
          id="tasks"
          icon={<ListChecks className="h-4 w-4" />}
          title={`Tasks (${openTasks.length})`}
          collapsedIndicator={openTasks.length > 0 ? <Badge variant="secondary" className="text-[10px] tabular-nums">{openTasks.length}</Badge> : null}
          headerRight={
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Quick follow-up tomorrow"
                title="Quick follow-up tomorrow"
                disabled={pending}
                onClick={() => start(async () => (await quickFollowUpAction(personId, 1), refresh()))}
                className="h-6 w-6 text-primary"
              >
                <Zap className="h-3.5 w-3.5" />
              </Button>
              <AddButton
                aria-label="Add task"
                onClick={() => {
                  const el = document.getElementById(`rail-new-task-${personId}`)
                  el?.focus()
                }}
              />
            </>
          }
        >
          <div className="space-y-1.5">
            {openTasks.length === 0 ? <p className="py-1 text-sm text-muted-foreground">No upcoming tasks</p> : null}
            {openTasks.slice(0, 8).map((t) => {
              const overdue = nowMs != null && t.dueAt ? new Date(t.dueAt).getTime() < nowMs : false
              return (
                <div key={t.id} className="flex items-start gap-2">
                  <Checkbox
                    aria-label={`Complete ${t.name}`}
                    disabled={pending}
                    onCheckedChange={() =>
                      start(async () => {
                        const fd = new FormData()
                        fd.set('taskId', String(t.id))
                        fd.set('personId', String(personId))
                        await completeCrmTaskAction(fd)
                        refresh()
                      })
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.type ?? 'Task'}
                      {t.dueAt ? (
                        <>
                          {' · '}
                          <span className={cn(overdue && 'font-medium text-destructive')}>{fmtDate(t.dueAt)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              )
            })}
            <div className="flex gap-1.5 pt-1">
              <Input
                id={`rail-new-task-${personId}`}
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="New task"
                className="h-8 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTask.trim()) {
                    start(async () => {
                      const fd = new FormData()
                      fd.set('personId', String(personId))
                      fd.set('name', newTask.trim())
                      fd.set('type', 'Follow Up')
                      fd.set('dueHours', '24')
                      await addCrmTaskAction(fd)
                      setNewTask('')
                      refresh()
                    })
                  }
                }}
              />
            </div>
          </div>
        </RailSection>

        {/* Appointments (§7c.8.4) */}
        <RailSection
          id="appointments"
          icon={<Calendar className="h-4 w-4" />}
          title="Appointments"
          collapsedIndicator={upcomingAppts.length > 0 ? <Badge variant="secondary" className="text-[10px] tabular-nums">{upcomingAppts.length}</Badge> : null}
          headerRight={
            <a href={`/admin/crm/calendar?person=${personId}`} aria-label="Add appointment">
              <AddButton />
            </a>
          }
        >
          {appointments.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No upcoming appointments</p>
          ) : (
            <div className="space-y-1.5">
              {appointments.slice(0, 5).map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(a.startAt)}
                    {a.typeName ? ` · ${a.typeName}` : ''}
                    {a.outcomeName ? ` · ${a.outcomeName}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Website Activity (§7c.8.5 slot — in-house equivalent of the AgentFire FUB widget) */}
        {websiteActivityNode ? (
          <RailSection id="website-activity" icon={<Footprints className="h-4 w-4" />} title="Website Activity" defaultOpen={false}>
            {websiteActivityNode}
          </RailSection>
        ) : null}

        {/* Deals (§7c.8.6) */}
        <RailSection
          id="deals"
          icon={<Briefcase className="h-4 w-4" />}
          title="Deals"
          headerRight={
            <a href="/admin/crm/deals" aria-label="Add deal">
              <AddButton />
            </a>
          }
        >
          {deals.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No deals yet</p>
          ) : (
            <div className="space-y-1.5">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{d.name ?? d.propertyAddress ?? `Deal #${d.id}`}</span>
                    {d.stage ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {d.stage}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {usd(d.value) ?? ''}
                    {d.closeDate ? `${d.value ? ' · ' : ''}closes ${fmtDate(d.closeDate)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Automations (§7c.8.7) — merged with action plans post-FUB-2.0; shows the same enrollments */}
        <RailSection id="automations" icon={<Play className="h-4 w-4" />} title="Automations" defaultOpen={false}>
          {runningPlans.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No automations running</p>
          ) : (
            <div className="space-y-1">
              {runningPlans.map((e) => (
                <div key={e.enrollmentId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{e.sequenceName}</span>
                  <span className="flex items-center gap-1 text-xs text-success">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Running
                  </span>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Files (§7c.8.8) */}
        <FilesSection personId={personId} files={files} />

        {/* Collaborators (§7c.8.9) */}
        <RailSection
          id="collaborators"
          icon={<Users className="h-4 w-4" />}
          title="Collaborators"
          headerRight={
            <CollaboratorsDialog personId={personId} collaborators={collaborators} brokerOptions={brokerOptions} assignedBroker={assignedBroker} />
          }
        >
          {collaborators.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No collaborators added</p>
          ) : (
            <div className="space-y-1">
              {collaborators.map((c) => (
                <div key={c.brokerSlug} className="group flex items-center justify-between gap-2 text-sm">
                  <span>{c.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${c.name}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await removeCrmCollaboratorAction(personId, c.brokerSlug)
                        refresh()
                      })
                    }
                    className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </RailSection>
      </div>

      {/* Keyboard shortcut hint (§7c.8.10) */}
      <p className="mt-auto pt-4 text-center text-xs text-muted-foreground">
        Press <kbd className="rounded border border-border bg-card px-1">→</kbd> to view next lead or{' '}
        <kbd className="rounded border border-border bg-card px-1">←</kbd> to view previous lead
      </p>
    </div>
  )
}
