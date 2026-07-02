// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, setCrmSequenceStatusAction } from '@/app/actions/crm'
import {
  createCrmSequenceAction,
  duplicateCrmSequenceAction,
  archiveCrmSequenceAction,
  deleteCrmSequenceAction,
  createCrmSequenceFolderAction,
  renameCrmSequenceFolderAction,
  deleteCrmSequenceFolderAction,
  moveCrmSequenceToFolderAction,
} from '@/app/actions/crm-sequences'
import {
  createCrmAutomationRuleAction,
  updateCrmAutomationRuleAction,
  setCrmAutomationRuleActiveAction,
  deleteCrmAutomationRuleAction,
  reorderCrmAutomationRulesAction,
} from '@/app/actions/crm-automation-rules'
import { getWorkflowAnalytics } from '@/lib/data/crm/getWorkflowAnalytics'
import { getCrmAutomationsAdminList, getCrmSequenceFolders } from '@/lib/data/crm/getAutomationsAdmin'
import { getCrmAutomationRules } from '@/lib/data/crm/getCrmAutomationRules'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import {
  AutomationsListView,
  type AutomationListRow,
  type WorkflowPlanType,
} from '@/components/admin/crm/automations/AutomationsListView'
import {
  AutomationRulesManager,
  type RuleRow,
} from '@/components/admin/crm/workflows/AutomationRulesManager'

export const metadata = { title: 'Automations | CRM | Admin' }
export const dynamic = 'force-dynamic'

/** Broker headshots for the Created By column (§12.2.3 col 7). */
const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

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

async function createFolder(name: string) {
  'use server'
  return createCrmSequenceFolderAction({ name })
}

async function renameFolder(id: number, name: string) {
  'use server'
  return renameCrmSequenceFolderAction({ id, name })
}

async function removeFolder(id: number) {
  'use server'
  return deleteCrmSequenceFolderAction(id)
}

async function moveToFolder(sequenceId: number, folderId: number | null) {
  'use server'
  return moveCrmSequenceToFolderAction({ sequenceId, folderId })
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

/** Map FUB legacy plan IDs to canonical plan types for badge rendering.
 *  These IDs come from the FUB API export (enroll.ts RULES constant):
 *  69 = seller master, 70 = buyer master, 71 = expired, 72 = fsbo. */
function planTypeFromFubId(fubId: number | null | undefined): WorkflowPlanType {
  switch (fubId) {
    case 69: return 'seller'
    case 70: return 'buyer'
    case 71: return 'expired'
    case 72: return 'fsbo'
    default: return null
  }
}

/** shot-34 date convention: M/D/YYYY, formatted server-side (hydration-safe). */
const CREATED_ON_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
})

export default async function CrmAutomationsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const broker = scopeBroker(access)

  const [sequences, folders, analytics, rules, tags, stages] = await Promise.all([
    getCrmAutomationsAdminList(),
    getCrmSequenceFolders(),
    getWorkflowAnalytics(broker),
    getCrmAutomationRules(),
    getCrmTags(),
    getCrmStages(),
  ])

  const analyticsById = new Map(analytics.rows.map((r) => [r.id, r]))

  const rows: AutomationListRow[] = sequences.map((s) => {
    const a = analyticsById.get(s.id)
    const createdBy = s.createdBy && CRM_BROKER_DISPLAY[s.createdBy as CrmBrokerSlug]
      ? { name: CRM_BROKER_DISPLAY[s.createdBy as CrmBrokerSlug], avatar: BROKER_HEADSHOT[s.createdBy] ?? null }
      : { name: 'Ryan Realty', avatar: null }
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      stepCount: s.stepCount,
      planType: planTypeFromFubId(s.fubLegacyPlanId),
      isAutoEnrollMaster: s.fubLegacyPlanId != null,
      usedBy: s.usedBy,
      started: a?.enrolled ?? 0,
      engaged: a?.engaged ?? null,
      completed: a?.completed ?? 0,
      createdByName: createdBy.name,
      createdByAvatarUrl: createdBy.avatar,
      createdOnLabel: CREATED_ON_FMT.format(new Date(s.createdAt)),
      createdAtMs: Date.parse(s.createdAt),
      folderId: s.folderId,
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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0">
          Back to CRM
        </Link>
        <Link href="/admin/crm/workflows" className="shrink-0">
          <Button variant="outline" size="sm" className="h-8">
            Enrollment board
          </Button>
        </Link>
      </div>

      {/* §12.2 Automations list — header, folder cards, 10-column table */}
      <AutomationsListView
        rows={rows}
        folders={folders}
        analyticsUnreadable={analytics.unreadable}
        actions={{
          create: createWorkflow,
          duplicate: duplicateWorkflow,
          setStatus: setWorkflowStatus,
          archive: archiveWorkflow,
          remove: removeWorkflow,
          createFolder,
          renameFolder,
          deleteFolder: removeFolder,
          moveToFolder,
        }}
      />

      {/* Enrollment rules — the engine's event → enroll path (kept from the
          working build; §12.9.2 automatic enrollment). */}
      <ConsoleSection title="Enrollment rules" className="mt-10">
        <p className="mb-3 text-sm text-muted-foreground">
          Rules that enroll a contact automatically. The tag-added to enroll-in-automation path runs in the engine
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
