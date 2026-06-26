// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getLeadFlows } from '@/lib/data/crm/getLeadFlow'
import { getCrmGroups } from '@/lib/data/crm/getCrmGroups'
import { getCrmPonds } from '@/lib/data/crm/getCrmPonds'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  createLeadFlowAction,
  updateLeadFlowAction,
  archiveLeadFlowAction,
  deleteLeadFlowAction,
  upsertLeadFlowRuleAction,
  deleteLeadFlowRuleAction,
} from '@/app/actions/crm-lead-flows'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import LeadFlowEditor from '@/components/admin/crm/settings/LeadFlowEditor'

export const metadata = { title: 'Lead Flows | CRM settings | Admin' }
export const dynamic = 'force-dynamic'

type Result = { ok: boolean; error?: string; id?: number }

export default async function CrmLeadFlowsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [flows, groups, ponds, brokers] = await Promise.all([
    getLeadFlows(),
    getCrmGroups(),
    getCrmPonds(),
    getCrmBrokers(),
  ])
  const brokerOptions = brokers.map((b) => ({ slug: b.slug, name: b.name || b.slug }))

  async function create(formData: FormData): Promise<Result> {
    'use server'
    return createLeadFlowAction(formData)
  }
  async function update(formData: FormData): Promise<Result> {
    'use server'
    return updateLeadFlowAction(formData)
  }
  async function archive(formData: FormData): Promise<Result> {
    'use server'
    return archiveLeadFlowAction(formData)
  }
  async function del(formData: FormData): Promise<Result> {
    'use server'
    return deleteLeadFlowAction(formData)
  }
  async function upsertRule(formData: FormData): Promise<Result> {
    'use server'
    return upsertLeadFlowRuleAction(formData)
  }
  async function deleteRule(formData: FormData): Promise<Result> {
    'use server'
    return deleteLeadFlowRuleAction(formData)
  }

  return (
    <SettingsSubpageShell
      title="Lead Flows"
      description="Map a lead source to a broker, group, or pond. Optionally add conditional rules that override the default assignment."
    >
      <div className="mt-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Lead Flows are evaluated first when a new lead arrives. If the lead&apos;s source matches a flow, the flow&apos;s rules run in order and the first match determines where the lead routes. Unmatched leads fall back to the global Lead routing setting.
      </div>

      <div className="mt-6">
        {flows.length === 0 && (
          <ConsoleSection title="No lead flows yet">
            <p className="text-sm text-muted-foreground">Create your first lead flow below to override the global routing for a specific source.</p>
          </ConsoleSection>
        )}

        <LeadFlowEditor
          flows={flows}
          groups={groups}
          ponds={ponds}
          brokers={brokerOptions}
          createLeadFlowAction={create}
          updateLeadFlowAction={update}
          archiveLeadFlowAction={archive}
          deleteLeadFlowAction={del}
          upsertLeadFlowRuleAction={upsertRule}
          deleteLeadFlowRuleAction={deleteRule}
        />
      </div>
    </SettingsSubpageShell>
  )
}
