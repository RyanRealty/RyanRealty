'use client'

/**
 * PersonRightRail — §7c.8 right action rail of the person-detail three-column
 * layout (spec docs/crm-spec/07c-person-detail-compose-modals-and-right-
 * rail.md). Light-muted background, independently scrollable.
 *
 * Top metadata strip (§07b 13) → widgets in documented order: Action Plans ·
 * Activity ("Seen X ago") · Tasks (N) · Appointments · Deals · Automations ·
 * Files (+ = Upload File(s) / Add Link dropdown, drag-drop target) ·
 * Collaborators → keyboard-shortcut hint pinned at the bottom.
 *
 * Collapse state persists per user (localStorage). Drag-reorder of widgets is
 * a logged deferral. The AgentFire CRM Widget section is CRM-specific
 * third-party embed and is intentionally not reproduced (logged decision).
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action and user-visible
 * string is unchanged. Four notes on the swap:
 *  - Radix Collapsible is gone: each RailSection already owned its `open`
 *    state, so it now simply does not render its body when closed — which is
 *    what CollapsibleContent did — and the chevron keeps aria-expanded.
 *  - Radix DropdownMenu is gone: the Files "+" is the barrel's Menu, which
 *    owns click-outside, Escape, focus return and arrow-key roving.
 *  - Counts and statuses are plain token-styled chips, not StateWord.
 *    .av2-state uppercases, and an enrollment status and a deal stage are
 *    broker-facing data that must read back the way it was written.
 *  - The rail sits on var(--a-inset) and its cards on var(--a-surface): two
 *    different tokens, so a card still reads as a card on the well.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
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
import {
  Button,
  Dialog,
  IconButton,
  Menu,
  SearchField,
  TextField,
  ToolbarCheck,
} from '@/components/admin/v2'
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
  sequenceId: number
  sequenceName: string
  stepIndex: number
  totalSteps: number
  status: string
  enrolledAt: string
}
export type RailTask = { id: number; name: string; type: string | null; dueAt: string | null; assignedBroker: string | null }
export type RailCollaborator = { brokerSlug: string; name: string }

const MUTED: React.CSSProperties = { color: 'var(--a-text-2)' }

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

/** Count / status chip. Sentence case on purpose — see the header note. */
function RailChip({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok'; children: React.ReactNode }) {
  const ok = tone === 'ok'
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
      style={{
        background: ok ? 'var(--a-ok-wash)' : 'var(--a-inset)',
        color: ok ? 'var(--a-ok)' : 'var(--a-text-2)',
      }}
    >
      {children}
    </span>
  )
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
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span style={MUTED}>{icon}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
          {title}
        </span>
        {!open ? collapsedIndicator : null}
        {headerRight}
        <IconButton
          label={open ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={open}
          onClick={() => toggle(!open)}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </IconButton>
      </div>
      {open ? (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--a-border)' }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The rail's solid circular "+" trigger. av2-addbtn is the barrel's class for
 * exactly this (an IconButton painted as a solid add control) — a class rather
 * than an inline style so :hover survives.
 */
function AddButton({
  label,
  ...rest
}: { label: string } & Omit<React.ComponentProps<'button'>, 'aria-label'>) {
  return (
    <IconButton label={label} className="av2-addbtn" {...rest}>
      <Plus className="h-3.5 w-3.5" />
    </IconButton>
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
    <>
      <AddButton label="Add collaborator" onClick={() => openDialog(true)} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Collaborators"
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save
            </Button>
          </>
        }
      >
        <SearchField
          aria-label="Search for a collaborator"
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a collaborator"
          className="w-full"
          style={{ maxWidth: 'none' }}
        />
        <div className="space-y-1">
          {visible.map((c) => (
            <ToolbarCheck
              key={c.value}
              label={c.label}
              checked={checked.has(c.value)}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev)
                  if (e.target.checked) next.add(c.value)
                  else next.delete(c.value)
                  return next
                })
              }
              labelStyle={{ display: 'flex', padding: '6px 4px', borderRadius: 'var(--a-r-sm)' }}
            />
          ))}
          {visible.length === 0 ? (
            <p className="py-3 text-center text-sm" style={MUTED}>
              No team members found.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
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
        <Menu
          label="Add file"
          align="end"
          trigger={<Plus className="h-3.5 w-3.5" />}
          items={[
            { label: 'Upload File(s)', onSelect: () => fileInput.current?.click() },
            { label: 'Add Link', onSelect: () => setLinkOpen(true) },
          ]}
        />
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
        className={dragOver ? 'space-y-1.5 rounded-md p-2' : 'space-y-1.5 rounded-md'}
        // Drop-target highlight has no :hover to fight, so it stays inline.
        style={dragOver ? { border: '2px dashed var(--a-accent)', background: 'var(--a-accent-wash)' } : undefined}
      >
        {files.length === 0 ? (
          <p className="py-1 text-sm" style={MUTED}>
            No files yet, drag some here
          </p>
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
                <span className="text-xs" style={MUTED} title={f.uploadedBy ?? undefined}>
                  {f.kind === 'link' ? 'Link' : 'File'} · {fmtAgo(f.createdAt, nowMs)}
                </span>
              </div>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${f.name}`}
                  className="rounded p-1 text-[color:var(--a-text-2)] opacity-0 hover:text-[color:var(--a-text)] group-hover:opacity-100"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <IconButton
                label={`Delete ${f.name}`}
                tone="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deletePersonFileAction(f.id)
                    router.refresh()
                  })
                }
                className="opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          ))
        )}
        {pending ? (
          <p className="text-xs" style={MUTED}>
            Working…
          </p>
        ) : null}
        {error ? (
          <p className="text-xs" style={{ color: 'var(--a-danger)' }}>
            {error}
          </p>
        ) : null}
      </div>

      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add Link"
        footer={
          <>
            <Button variant="quiet" onClick={() => setLinkOpen(false)}>
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
          </>
        }
      >
        <div className="space-y-2">
          <TextField label="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          <TextField label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          {error ? (
            <p className="text-xs" style={{ color: 'var(--a-danger)' }}>
              {error}
            </p>
          ) : null}
        </div>
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
  /** §7c.8.5 website-activity slot (our equivalent of CRM's AgentFire widget). */
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
    <div
      data-tour="person-right-rail"
      className="flex h-full flex-col overflow-y-auto px-3 py-3"
      style={{ background: 'var(--a-inset)' }}
    >
      {/* Last-lead metadata strip (§07b 13) */}
      {(metaAddress || metaCreatedAt || metaAssignedName) && (
        <div className="mb-3 space-y-0.5 px-1 text-xs" style={MUTED}>
          {metaAddress ? (
            <p className="font-medium" style={{ color: 'var(--a-text)' }}>
              {metaAddress}
            </p>
          ) : null}
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
          collapsedIndicator={runningPlans.length > 0 ? <RailChip tone="ok">{runningPlans.length}</RailChip> : null}
          headerRight={
            <ApplyAutomationDialog
              personId={personId}
              automations={automationOptions}
              trigger={<AddButton label="Apply automation" />}
            />
          }
        >
          {enrollments.length === 0 ? (
            <p className="py-1 text-sm" style={MUTED}>
              No action plans running
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => (
                <div key={e.enrollmentId} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/crm/sequences/${e.sequenceId}/edit`}
                      className="truncate text-sm font-medium"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {e.sequenceName}
                    </Link>
                    <span className="capitalize">
                      <RailChip tone={e.status === 'running' ? 'ok' : 'neutral'}>
                        {e.status.replace(/_/g, ' ')}
                      </RailChip>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs" style={MUTED}>
                    <span>
                      {Math.min(e.stepIndex, e.totalSteps)} of {e.totalSteps} steps complete · Started {fmtAgo(e.enrolledAt, nowMs)}
                    </span>
                    <span className="flex gap-0.5">
                      {e.status === 'running' ? (
                        <IconButton
                          label="Pause plan"
                          disabled={pending}
                          onClick={() => start(async () => (await pauseEnrollmentAction(e.enrollmentId), refresh()))}
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </IconButton>
                      ) : (
                        <IconButton
                          label="Resume plan"
                          disabled={pending}
                          onClick={() => start(async () => (await resumeEnrollmentAction(e.enrollmentId), refresh()))}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </IconButton>
                      )}
                      <IconButton
                        label="Stop plan"
                        tone="danger"
                        disabled={pending}
                        onClick={() => start(async () => (await dismissEnrollmentAction(e.enrollmentId), refresh()))}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </IconButton>
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
          headerRight={
            lastSeenAt ? (
              <span className="text-xs" style={MUTED}>
                Seen {fmtAgo(lastSeenAt, nowMs)}
              </span>
            ) : null
          }
        >
          <dl className="space-y-1">
            {activitySummary.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <dt style={MUTED}>{s.label}</dt>
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
          collapsedIndicator={openTasks.length > 0 ? <RailChip>{openTasks.length}</RailChip> : null}
          headerRight={
            <>
              <IconButton
                label="Quick follow-up tomorrow"
                disabled={pending}
                onClick={() => start(async () => (await quickFollowUpAction(personId, 1), refresh()))}
              >
                <Zap className="h-3.5 w-3.5" />
              </IconButton>
              <AddButton
                label="Add task"
                onClick={() => {
                  const el = document.getElementById(`rail-new-task-${personId}`)
                  el?.focus()
                }}
              />
            </>
          }
        >
          <div className="space-y-1.5">
            {openTasks.length === 0 ? (
              <p className="py-1 text-sm" style={MUTED}>
                No upcoming tasks
              </p>
            ) : null}
            {openTasks.slice(0, 8).map((t) => {
              const overdue = nowMs != null && t.dueAt ? new Date(t.dueAt).getTime() < nowMs : false
              return (
                <div key={t.id} className="flex items-start gap-2">
                  <ToolbarCheck
                    label={null}
                    aria-label={`Complete ${t.name}`}
                    disabled={pending}
                    onChange={() =>
                      start(async () => {
                        const fd = new FormData()
                        fd.set('taskId', String(t.id))
                        fd.set('personId', String(personId))
                        await completeCrmTaskAction(fd)
                        refresh()
                      })
                    }
                    labelStyle={{ marginTop: 2 }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs" style={MUTED}>
                      {t.type ?? 'Task'}
                      {t.dueAt ? (
                        <>
                          {' · '}
                          <span style={overdue ? { fontWeight: 500, color: 'var(--a-danger)' } : undefined}>
                            {fmtDate(t.dueAt)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              )
            })}
            <div className="flex gap-1.5 pt-1">
              <SearchField
                id={`rail-new-task-${personId}`}
                aria-label="New task"
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="New task"
                className="flex-1"
                style={{ maxWidth: 'none' }}
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
          collapsedIndicator={upcomingAppts.length > 0 ? <RailChip>{upcomingAppts.length}</RailChip> : null}
          headerRight={
            <a href={`/admin/crm/calendar?person=${personId}`} aria-label="Add appointment">
              <AddButton label="Add appointment" />
            </a>
          }
        >
          {appointments.length === 0 ? (
            <p className="py-1 text-sm" style={MUTED}>
              No upcoming appointments
            </p>
          ) : (
            <div className="space-y-1.5">
              {appointments.slice(0, 5).map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs" style={MUTED}>
                    {fmtDate(a.startAt)}
                    {a.typeName ? ` · ${a.typeName}` : ''}
                    {a.outcomeName ? ` · ${a.outcomeName}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Website Activity (§7c.8.5 slot — in-house equivalent of the AgentFire CRM widget).
            Open by default since the admin consolidation (2026-07-07): this section now
            carries the lead's alerts, report subscriptions, and email delivery story —
            the core of the person-as-lead-hub. Collapse state still persists per user. */}
        {websiteActivityNode ? (
          <RailSection id="website-activity" icon={<Footprints className="h-4 w-4" />} title="Website Activity" defaultOpen>
            {websiteActivityNode}
          </RailSection>
        ) : null}

        {/* Deals (§7c.8.6) */}
        <RailSection
          id="deals"
          icon={<Briefcase className="h-4 w-4" />}
          title="Deals"
          headerRight={
            <Link href="/admin/crm/deals" aria-label="Add deal">
              <AddButton label="Add deal" />
            </Link>
          }
        >
          {deals.length === 0 ? (
            <p className="py-1 text-sm" style={MUTED}>
              No deals yet
            </p>
          ) : (
            <div className="space-y-1.5">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{d.name ?? d.propertyAddress ?? `Deal #${d.id}`}</span>
                    {d.stage ? <RailChip>{d.stage}</RailChip> : null}
                  </div>
                  <p className="text-xs tabular-nums" style={MUTED}>
                    {usd(d.value) ?? ''}
                    {d.closeDate ? `${d.value ? ' · ' : ''}closes ${fmtDate(d.closeDate)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </RailSection>

        {/* Automations (§7c.8.7) — merged with action plans post-CRM-2.0; shows the same enrollments */}
        <RailSection id="automations" icon={<Play className="h-4 w-4" />} title="Automations" defaultOpen={false}>
          {runningPlans.length === 0 ? (
            <p className="py-1 text-sm" style={MUTED}>
              No automations running
            </p>
          ) : (
            <div className="space-y-1">
              {runningPlans.map((e) => (
                <div key={e.enrollmentId} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/admin/crm/sequences/${e.sequenceId}/edit`}
                    className="truncate"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {e.sequenceName}
                  </Link>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--a-ok)' }}>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--a-ok)' }}
                    />{' '}
                    Running
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
            <p className="py-1 text-sm" style={MUTED}>
              No collaborators added
            </p>
          ) : (
            <div className="space-y-1">
              {collaborators.map((c) => (
                <div key={c.brokerSlug} className="group flex items-center justify-between gap-2 text-sm">
                  <span>{c.name}</span>
                  <IconButton
                    label={`Remove ${c.name}`}
                    tone="danger"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await removeCrmCollaboratorAction(personId, c.brokerSlug)
                        refresh()
                      })
                    }
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </RailSection>
      </div>

      {/* Keyboard shortcut hint (§7c.8.10) */}
      <p className="mt-auto pt-4 text-center text-xs" style={MUTED}>
        Press{' '}
        <kbd className="rounded px-1" style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}>
          →
        </kbd>{' '}
        to view next lead or{' '}
        <kbd className="rounded px-1" style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}>
          ←
        </kbd>{' '}
        to view previous lead
      </p>
    </div>
  )
}
