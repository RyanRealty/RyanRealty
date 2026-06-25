// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  listCrmSequences,
  setCrmSequenceStatusAction,
} from '@/app/actions/crm'
import {
  createCrmSequenceAction,
  duplicateCrmSequenceAction,
  archiveCrmSequenceAction,
  deleteCrmSequenceAction,
} from '@/app/actions/crm-sequences'
import {
  createCrmAutomationRuleAction,
  updateCrmAutomationRuleAction,
  setCrmAutomationRuleActiveAction,
  deleteCrmAutomationRuleAction,
  reorderCrmAutomationRulesAction,
} from '@/app/actions/crm-automation-rules'
import { getWorkflowAnalytics } from '@/lib/data/crm/getWorkflowAnalytics'
import { getCrmAutomationRules } from '@/lib/data/crm/getCrmAutomationRules'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { WorkflowList, type WorkflowRow } from '@/components/admin/crm/workflows/WorkflowList'
import {
  AutomationRulesManager,
  type RuleRow,
} from '@/components/admin/crm/workflows/AutomationRulesManager'

export const metadata = { title: 'Workflows | CRM | Admin' }
export const dynamic = 'force-dynamic'

// ── Server-action adapters (the islands call typed callbacks) ──────────────────

async function createWorkflow(input: {
  name: string
  description?: string | null
  stopOnReply: boolean
}): Promise<{ ok: true; id?: number } | { ok: false; error: string }> {
  'use server'
  return createCrmSequenceAction(input)
}

async function duplicateWorkflow(id: number) {
  'use server'
  return duplicateCrmSequenceAction(id)
}

async function setWorkflowStatus(id: number, status: 'active' | 'paused') {
  'use server'
  const fd = new FormData()
  fd.set('sequenceId', String(id))
  fd.set('status', status)
  return setCrmSequenceStatusAction(fd)
}

async function archiveWorkflow(id: number) {
  'use server'
  return archiveCrmSequenceAction(id)
}

async function removeWorkflow(id: number) {
  'use server'
  return deleteCrmSequenceAction(id)
}

async function createRule(fd: FormData) {
  'use server'
  return createCrmAutomationRuleAction(fd)
}
async function updateRule(fd: FormData) {
  'use server'
  return updateCrmAutomationRuleAction(fd)
}
async function setRuleActive(fd: FormData) {
  'use server'
  return setCrmAutomationRuleActiveAction(fd)
}
async function removeRule(fd: FormData) {
  'use server'
  return deleteCrmAutomationRuleAction(fd)
}
async function reorderRules(orderedIds: number[]) {
  'use server'
  return reorderCrmAutomationRulesAction(orderedIds)
}

export default async function CrmSequencesPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const broker = scopeBroker(access)

  const [sequences, analytics, rules, tags, stages] = await Promise.all([
    listCrmSequences(),
    getWorkflowAnalytics(broker),
    getCrmAutomationRules(),
    getCrmTags(),
    getCrmStages(),
  ])

  const analyticsById = new Map(analytics.rows.map((r) => [r.id, r]))

  const rows: WorkflowRow[] = sequences.map((s) => {
    const a = analyticsById.get(s.id)
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      stepCount: Array.isArray(s.steps) ? s.steps.length : 0,
      isAutoEnrollMaster: s.fub_legacy_plan_id != null,
      enrolled: a?.enrolled ?? 0,
      active: a?.active ?? 0,
      completed: a?.completed ?? 0,
      stopped: a?.stopped ?? 0,
      awaitingBroker: a?.awaitingBroker ?? 0,
    }
  })

  const ruleRows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.isActive,
    triggerType: r.triggerType,
    triggerValue: r.triggerValue,
    actionType: r.actionType,
    actionValue: r.actionValue,
    position: r.position,
  }))

  const sequenceOptions = sequences.map((s) => ({ id: s.id, name: s.name }))
  const tagOptions = tags
    .filter((t) => t.isActive && !t.isProtected)
    .map((t) => ({ key: t.key, label: t.label }))
  const stageOptions = stages.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label }))
  const brokerOptions = CRM_BROKERS.map((slug) => ({
    slug,
    label: CRM_BROKER_DISPLAY[slug as CrmBrokerSlug],
  }))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0">
          Back to CRM
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Automated drip sequences. Build steps, set triggers, then activate. Active workflows send from the
            assigned broker&apos;s mailbox inside 7am to 7pm PT, pause on any reply, and never touch a suppressed
            contact.
          </p>
        </div>
        <Link href="/admin/crm/workflows" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 md:h-8">
            Enrollment board
          </Button>
        </Link>
      </div>

      <ConsoleSection title="Workflows" className="mt-6">
        <WorkflowList
          rows={rows}
          analyticsUnreadable={analytics.unreadable}
          actions={{
            create: createWorkflow,
            duplicate: duplicateWorkflow,
            setStatus: setWorkflowStatus,
            archive: archiveWorkflow,
            remove: removeWorkflow,
          }}
        />
      </ConsoleSection>

      <ConsoleSection title="Triggers" className="mt-8">
        <p className="mb-3 text-sm text-muted-foreground">
          Rules that enroll a contact automatically. The tag-added to enroll-in-workflow path runs in the engine
          today. First matching rule wins.
        </p>
        <AutomationRulesManager
          rows={ruleRows}
          sequences={sequenceOptions}
          tags={tagOptions}
          stages={stageOptions}
          brokers={brokerOptions}
          actions={{
            create: createRule,
            update: updateRule,
            setActive: setRuleActive,
            remove: removeRule,
            reorder: reorderRules,
          }}
        />
      </ConsoleSection>
    </main>
  )
}
