'use client'

/**
 * StepBuilder — the ordered step builder for one workflow (Wave 6 authoring).
 *
 * A linear, reorderable list of step cards (v1 has no branching). Per the engine
 * contract every saved step passes parseSteps server-side; this island mirrors
 * the same per-channel shape so the author never builds an invalid step:
 *   - email / sms: template picker (live templates) + delay in days
 *   - task: task name + delay in days
 *   - tag: add / remove tag multiselect (protected tags excluded) + delay in days
 *
 * Reorder is up/down buttons (robust + keyboard-accessible — no fragile native
 * HTML5 drag that breaks on touch / screen readers). Add step opens a channel
 * chooser; delete confirms. The header carries name / description / stop-on-reply.
 *
 * Save splits into two server calls: updateSteps (the steps jsonb, validated
 * against the engine schema + live templates) and updateSettings (identity +
 * reply behavior). Both surface their result inline.
 *
 * Design-system only. Dates are not computed here (the funnel passes formatted
 * strings in); the builder never reads the wall clock at render.
 */

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { channelLabel, cumulativeDays } from './step-display'
import { EMPTY_STEP, STEP_CHANNELS, type Step, type StepChannel } from '@/lib/crm/sequence-step-schema'

type ActionResult = { ok: true } | { ok: false; error: string }

export type TemplateOption = { key: string; name: string; channel: 'email' | 'sms' }
export type TagOption = { key: string; label: string }

export type StepBuilderActions = {
  saveSteps: (steps: Step[]) => Promise<ActionResult>
  saveSettings: (input: { name: string; description: string | null; stopOnReply: boolean }) => Promise<ActionResult>
}

export type StepFunnelRow = {
  stepIndex: number
  channel: string | null
  currentlyHere: number
  emailsSent: number | null
}

/** An editable step in builder state — the on-screen draft before validation. */
type DraftStep = Step

export function StepBuilder({
  sequenceId,
  initialName,
  initialDescription,
  initialStopOnReply,
  initialStatus,
  initialSteps,
  templates,
  tags,
  funnel,
  funnelUnreadable,
  actions,
}: {
  sequenceId: number
  initialName: string
  initialDescription: string
  initialStopOnReply: boolean
  initialStatus: string
  initialSteps: DraftStep[]
  templates: TemplateOption[]
  tags: TagOption[]
  funnel: StepFunnelRow[]
  funnelUnreadable: boolean
  actions: StepBuilderActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [stopOnReply, setStopOnReply] = useState(initialStopOnReply)
  const [steps, setSteps] = useState<DraftStep[]>(initialSteps)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null)

  const days = useMemo(() => cumulativeDays(steps), [steps])
  const emailTemplates = useMemo(() => templates.filter((t) => t.channel === 'email'), [templates])
  const smsTemplates = useMemo(() => templates.filter((t) => t.channel === 'sms'), [templates])

  function patchStep(idx: number, patch: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function move(idx: number, dir: -1 | 1) {
    setSteps((prev) => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[idx]
      next[idx] = next[target]
      next[target] = tmp
      return next
    })
  }

  function addStep(channel: StepChannel) {
    setSteps((prev) => [...prev, { ...EMPTY_STEP[channel] }])
    setAddOpen(false)
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    setDeleteIdx(null)
  }

  function run(action: () => Promise<ActionResult>, okText: string) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function saveAll() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNote({ tone: 'err', text: 'A workflow name is required' })
      return
    }
    setNote(null)
    startTransition(async () => {
      // Steps first (the strict validation). If it fails, do not touch settings.
      const stepsResult = await actions.saveSteps(steps)
      if (!stepsResult.ok) {
        setNote({ tone: 'err', text: stepsResult.error })
        return
      }
      const settingsResult = await actions.saveSettings({
        name: trimmedName,
        description: description.trim() || null,
        stopOnReply,
      })
      if (!settingsResult.ok) {
        setNote({ tone: 'err', text: settingsResult.error })
        return
      }
      setNote({ tone: 'ok', text: 'Workflow saved.' })
      router.refresh()
    })
  }

  const funnelByIndex = useMemo(() => {
    const map = new Map<number, StepFunnelRow>()
    for (const r of funnel) map.set(r.stepIndex, r)
    return map
  }, [funnel])

  return (
    <div className="space-y-6">
      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
        </Alert>
      ) : null}

      {/* Header — identity + reply behavior */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sb-name">Workflow name</Label>
              <Input id="sb-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <Label htmlFor="sb-stop" className="text-sm font-medium">
                    Stop on reply
                  </Label>
                  <p className="text-xs text-muted-foreground">Pause a person the moment they reply.</p>
                </div>
                <Switch id="sb-stop" checked={stopOnReply} disabled={pending} onCheckedChange={setStopOnReply} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-desc">Description (optional)</Label>
            <Textarea
              id="sb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Status: {initialStatus === 'active' ? 'Active' : initialStatus === 'archived' ? 'Archived' : 'Paused'}.
            Activate or pause from the workflow list.
          </p>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Steps</h2>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={pending}>
            Add step
          </Button>
        </div>

        {steps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No steps yet. Add the first step to build this workflow.
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, idx) => {
              const fr = funnelByIndex.get(idx)
              return (
                <li key={idx}>
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="tabular-nums">
                            Day {days[idx]}
                          </Badge>
                          <Badge variant="outline">{channelLabel(step.channel)}</Badge>
                          {fr ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {fr.currentlyHere} here
                              {step.channel === 'email' && fr.emailsSent != null ? ` · ${fr.emailsSent} sent` : ''}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={pending || idx === 0}
                            aria-label={`Move step ${idx + 1} up`}
                            onClick={() => move(idx, -1)}
                          >
                            <span aria-hidden>↑</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={pending || idx === steps.length - 1}
                            aria-label={`Move step ${idx + 1} down`}
                            onClick={() => move(idx, 1)}
                          >
                            <span aria-hidden>↓</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteIdx(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <StepEditor
                        idx={idx}
                        step={step}
                        emailTemplates={emailTemplates}
                        smsTemplates={smsTemplates}
                        tags={tags}
                        disabled={pending}
                        onPatch={(patch) => patchStep(idx, patch)}
                      />
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {funnelUnreadable ? (
        <Alert variant="destructive">
          <AlertDescription>Step analytics could not be read right now.</AlertDescription>
        </Alert>
      ) : null}

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => router.push('/admin/crm/sequences')} disabled={pending}>
          Back to workflows
        </Button>
        <Button onClick={saveAll} disabled={pending}>
          Save workflow
        </Button>
      </div>

      {/* Add-step channel chooser */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a step</DialogTitle>
            <DialogDescription>Pick what this step does. You can configure it after adding.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STEP_CHANNELS.map((c) => (
              <Button key={c} variant="outline" className="justify-start" onClick={() => addStep(c)} disabled={pending}>
                {channelLabel(c)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-step confirm */}
      <Dialog open={deleteIdx != null} onOpenChange={(o) => !pending && !o && setDeleteIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this step?</DialogTitle>
            <DialogDescription>
              The step is removed from the draft. Save the workflow to make it permanent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteIdx(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => deleteIdx != null && removeStep(deleteIdx)}
            >
              Remove step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Per-channel step editor ───────────────────────────────────────────────────

function DelayField({
  idx,
  value,
  disabled,
  onChange,
}: {
  idx: number
  value: number | undefined
  disabled: boolean
  onChange: (days: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`delay-${idx}`}>Wait (days before this step)</Label>
      <Input
        id={`delay-${idx}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={String(value ?? 0)}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.max(0, Math.trunc(Number(e.target.value)))
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
    </div>
  )
}

function StepEditor({
  idx,
  step,
  emailTemplates,
  smsTemplates,
  tags,
  disabled,
  onPatch,
}: {
  idx: number
  step: Step
  emailTemplates: TemplateOption[]
  smsTemplates: TemplateOption[]
  tags: TagOption[]
  disabled: boolean
  onPatch: (patch: Partial<Step>) => void
}) {
  if (step.channel === 'email' || step.channel === 'sms') {
    const options = step.channel === 'email' ? emailTemplates : smsTemplates
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`tpl-${idx}`}>Template</Label>
          <Select
            value={step.templateKey ?? ''}
            disabled={disabled}
            onValueChange={(v) => onPatch({ templateKey: v, body: undefined })}
          >
            <SelectTrigger id={`tpl-${idx}`}>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No {step.channel} templates
                </SelectItem>
              ) : (
                options.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!step.templateKey ? (
            <p className="text-xs text-muted-foreground">Pick a template before saving.</p>
          ) : null}
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  if (step.channel === 'task') {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`task-${idx}`}>Task name</Label>
          <Input
            id={`task-${idx}`}
            value={step.taskName ?? ''}
            disabled={disabled}
            onChange={(e) => onPatch({ taskName: e.target.value })}
          />
        </div>
        <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      </div>
    )
  }

  // tag
  return (
    <div className="space-y-3">
      <DelayField idx={idx} value={step.delayDays} disabled={disabled} onChange={(d) => onPatch({ delayDays: d })} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TagMultiselect
          legend="Add tags"
          idx={idx}
          slot="add"
          selected={step.addTags ?? []}
          tags={tags}
          disabled={disabled}
          onChange={(next) => onPatch({ addTags: next })}
        />
        <TagMultiselect
          legend="Remove tags"
          idx={idx}
          slot="remove"
          selected={step.removeTags ?? []}
          tags={tags}
          disabled={disabled}
          onChange={(next) => onPatch({ removeTags: next })}
        />
      </div>
      {(step.addTags?.length ?? 0) + (step.removeTags?.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">Pick at least one tag to add or remove before saving.</p>
      ) : null}
    </div>
  )
}

function TagMultiselect({
  legend,
  idx,
  slot,
  selected,
  tags,
  disabled,
  onChange,
}: {
  legend: string
  idx: number
  slot: string
  selected: string[]
  tags: TagOption[]
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  function toggle(key: string, checked: boolean) {
    const set = new Set(selected)
    if (checked) set.add(key)
    else set.delete(key)
    onChange([...set])
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="max-h-48 space-y-1.5 overflow-y-auto no-scrollbar rounded-lg border border-border p-3">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
        ) : (
          tags.map((t) => {
            const id = `tag-${slot}-${idx}-${t.key}`
            return (
              <Label key={t.key} htmlFor={id} className={cn('flex items-center gap-2 text-sm', disabled && 'opacity-60')}>
                <Checkbox
                  id={id}
                  checked={selected.includes(t.key)}
                  disabled={disabled}
                  onCheckedChange={(c) => toggle(t.key, c === true)}
                />
                <span className="min-w-0 truncate text-foreground">{t.label}</span>
              </Label>
            )
          })
        )}
      </div>
    </fieldset>
  )
}
