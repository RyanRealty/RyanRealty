// @no-parity — internal admin surface, no public mockup contract
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
import { AutomationEditor } from '@/components/admin/crm/automations/AutomationEditor'
import type {
  TemplateOption,
  TagOption,
  StageOption,
  BrokerOption,
  SequenceOption,
} from '@/components/admin/crm/automations/StepConfigPanel'
import type { CanvasFunnelRow } from '@/components/admin/crm/automations/EditorCanvas'

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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
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
    </main>
  )
}
