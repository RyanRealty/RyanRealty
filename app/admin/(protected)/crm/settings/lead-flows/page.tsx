// @no-parity — internal admin surface, no public mockup contract
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the owner-only guard, the six server-action wrappers, and
// the LeadFlowEditor contract are carried over verbatim. LeadFlowEditor itself is
// sanctioned legacy machinery (exclusively owned by this route; it migrates with
// a later unit).
import Link from 'next/link'
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
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import LeadFlowEditor from '@/app/admin/(protected)/crm/settings/_components/LeadFlowEditor'

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
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone={flows.length === 0 ? 'attention' : 'ok'}>
          {flows.length === 0 ? (
            <>
              <b>No lead flows yet.</b> Every lead falls through to the global routing setting.
            </>
          ) : (
            <>
              <b>
                {flows.length} lead flow{flows.length === 1 ? '' : 's'}.
              </b>{' '}
              Each maps a source to a broker, group, or pond before global routing runs.
            </>
          )}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ marginBottom: 4 }}>
        <Link href="/admin/crm/settings" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          CRM settings
        </Link>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '10px 0 0' }}>
        Lead Flows are evaluated first when a new lead arrives. If the lead&apos;s source matches a flow, the
        flow&apos;s rules run in order and the first match determines where the lead routes. Unmatched leads fall
        back to the global Lead routing setting.
      </p>

      <SectionHead>Flows</SectionHead>
      {flows.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
          Create your first lead flow below to override the global routing for a specific source.
        </p>
      ) : null}

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
  )
}
