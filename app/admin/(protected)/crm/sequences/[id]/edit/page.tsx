// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/sequences/[id]/edit — the automation editor. P11E: migrated to the
// LOCKED admin v2 language (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY.
//
// This page edits the steps, delays and triggers of automated outreach. Nothing
// on the mutation path was touched. Carried over verbatim: the
// `params: Promise<{id}>` signature and `await params`, the
// Number(idParam) / Number.isInteger / `id <= 0` → notFound() guard, the
// getCrmAccess() → /admin/access-denied redirect, scopeBroker(access), the
// seven-read Promise.all and every argument, `if (!seq) notFound()`, all four
// 'use server' adapters character for character (saveSteps → the id-bound
// updateCrmSequenceStepsAction; saveSettings and its {id,name,description,
// stopOnReply} payload; saveTriggers; setStatus and its FormData keys
// 'sequenceId' / 'status'), the templateOptions/tagOptions/stageOptions/
// brokerOptions filters, the §12.4.4 sequenceOptions rule (active only,
// excluding this one), the funnelRows mapping, and the initialSteps /
// initialTriggers Array.isArray coercions.
//
// AutomationEditor is MOUNTED UNCHANGED, with every prop identical — it owns
// the name field, the publish toggle, Save, and the whole canvas. The step
// timing a broker configures there cannot move through this change.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark) and the editor now opens under the state the funnel read
// already returned. No EntityTitle — the editor's own inline-editable name
// field IS this entity's title, and a second heading would fight it.
import { redirect, notFound } from 'next/navigation'
import { getCrmAccess, setCrmSequenceStatusAction } from '@/app/actions/crm'
import {
  updateCrmSequenceStepsAction,
  updateCrmSequenceSettingsAction,
  updateCrmSequenceTriggersAction,
} from '@/app/actions/crm-sequences'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmSequenceForEdit } from '@/lib/data/crm/getCrmSequenceForEdit'
import { getCrmAutomationsAdminList } from '@/lib/data/crm/getAutomationsAdmin'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getWorkflowStepAnalytics } from '@/lib/data/crm/getWorkflowAnalytics'
import { scopeBroker } from '@/lib/crm/scope'
import type { AnyStepOrCondition, SequenceTrigger } from '@/lib/crm/sequence-step-schema'
import { StateWord, VerdictLine } from '@/components/admin/v2'
import { AutomationEditor } from '@/app/admin/(protected)/crm/sequences/_components/AutomationEditor'
import type {
  TemplateOption,
  TagOption,
  StageOption,
  BrokerOption,
  SequenceOption,
} from '@/app/admin/(protected)/crm/sequences/_components/StepConfigPanel'
import type { CanvasFunnelRow } from '@/app/admin/(protected)/crm/sequences/_components/EditorCanvas'

export const metadata = { title: 'Edit automation | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const broker = scopeBroker(access)

  const [seq, templates, tags, funnel, stages, brokers, allSequences] = await Promise.all([
    getCrmSequenceForEdit(id),
    getCrmTemplatesAdmin(),
    getCrmTags(),
    getWorkflowStepAnalytics(id, broker),
    getCrmStages(),
    getCrmBrokers(),
    getCrmAutomationsAdminList(),
  ])

  if (!seq) notFound()

  // ── Server-action adapters bound to this sequence id ────────────────────────

  async function saveSteps(steps: AnyStepOrCondition[]) {
    'use server'
    return updateCrmSequenceStepsAction(id, steps)
  }

  async function saveSettings(input: { name: string; description: string | null; stopOnReply: boolean }) {
    'use server'
    return updateCrmSequenceSettingsAction({
      id,
      name: input.name,
      description: input.description,
      stopOnReply: input.stopOnReply,
    })
  }

  async function saveTriggers(triggers: SequenceTrigger[]) {
    'use server'
    return updateCrmSequenceTriggersAction(id, triggers)
  }

  async function setStatus(status: 'active' | 'paused') {
    'use server'
    const fd = new FormData()
    fd.set('sequenceId', String(id))
    fd.set('status', status)
    return setCrmSequenceStatusAction(fd)
  }

  const templateOptions: TemplateOption[] = templates
    .filter((t) => t.isActive)
    .map((t) => ({ key: t.key, name: t.name, channel: t.channel }))

  const tagOptions: TagOption[] = tags
    .filter((t) => t.isActive && !t.isProtected)
    .map((t) => ({ key: t.key, label: t.label }))

  const stageOptions: StageOption[] = stages
    .filter((s) => s.isActive)
    .map((s) => ({ key: s.key, label: s.label }))

  const brokerOptions: BrokerOption[] = brokers
    .filter((b) => b.crmActive)
    .map((b) => ({ slug: b.slug, label: b.name }))

  // Run Automation targets: ACTIVE automations only (§12.4.4 — "only active
  // automations appear"), excluding this one.
  const sequenceOptions: SequenceOption[] = allSequences
    .filter((s) => s.id !== id && s.status === 'active')
    .map((s) => ({ id: s.id, name: s.name }))

  const funnelRows: CanvasFunnelRow[] = funnel.rows.map((r) => ({
    stepIndex: r.stepIndex,
    currentlyHere: r.currentlyHere,
    emailsSent: r.emailsSent,
  }))

  const initialSteps = (Array.isArray(seq.steps) ? seq.steps : []) as AnyStepOrCondition[]
  const initialTriggers = (Array.isArray(seq.triggers) ? seq.triggers : []) as SequenceTrigger[]

  // The verdict reads the same two values the editor is handed below: the
  // sequence's own status, and the funnel rows already fetched for the canvas.
  const onAStep = funnelRows.reduce((n, r) => n + r.currentlyHere, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 1280, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={funnel.unreadable ? 'attention' : seq.status === 'active' ? 'ok' : 'attention'}>
          <StateWord state={seq.status === 'active' ? 'ok' : 'waiting'}>{seq.status}</StateWord>{' '}
          <b>
            {initialSteps.length.toLocaleString('en-US')}{' '}
            {initialSteps.length === 1 ? 'step' : 'steps'}.
          </b>{' '}
          {funnel.unreadable ? (
            <>Who is standing on a step could not be read, so no count is shown.</>
          ) : (
            <>
              {onAStep.toLocaleString('en-US')} {onAStep === 1 ? 'contact is' : 'contacts are'} on a
              step right now.
            </>
          )}
        </VerdictLine>
      </div>

      <AutomationEditor
        initialName={seq.name}
        initialDescription={seq.description ?? ''}
        initialStopOnReply={seq.stopOnReply}
        initialStatus={seq.status}
        initialSteps={initialSteps}
        initialTriggers={initialTriggers}
        templates={templateOptions}
        tags={tagOptions}
        stages={stageOptions}
        brokers={brokerOptions}
        sequences={sequenceOptions}
        funnel={funnelRows}
        funnelUnreadable={funnel.unreadable}
        actions={{ saveSteps, saveSettings, saveTriggers, setStatus }}
      />
    </div>
  )
}
