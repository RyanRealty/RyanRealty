// @no-parity — internal admin surface, no public mockup contract
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the owner-only guard, the four server-action wrappers, and
// the RoutingEditor contract are carried over verbatim. RoutingEditor itself is
// sanctioned legacy machinery (exclusively owned by this route; it migrates with
// a later unit, same pattern as the people/[id] composer chokepoints).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  setStrategyAction,
  setDefaultBrokerAction,
  upsertSourceRuleAction,
  deleteSourceRuleAction,
} from '@/app/actions/crm-assignment'
import { getCrmAssignmentConfig } from '@/lib/data/crm/getCrmAssignmentConfig'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import RoutingEditor from '@/components/admin/crm/settings/RoutingEditor'

export const metadata = { title: 'Lead routing | CRM settings | Admin' }
export const dynamic = 'force-dynamic'

type Result = { ok: boolean; error?: string }

export default async function CrmRoutingSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  // Lead routing decides which broker earns a lead — owner only, like the hub.
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [config, brokers] = await Promise.all([getCrmAssignmentConfig(), getCrmBrokers()])
  const brokerOptions = brokers.map((b) => ({ slug: b.slug, name: b.name || b.slug, routingEligible: b.routingEligible }))

  // ── Owner-only action wrappers (uniform { ok, error }) ────────────────────
  async function setStrategy(formData: FormData): Promise<Result> {
    'use server'
    const r = await setStrategyAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function setDefaultBroker(formData: FormData): Promise<Result> {
    'use server'
    const r = await setDefaultBrokerAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function upsertRule(formData: FormData): Promise<Result> {
    'use server'
    const r = await upsertSourceRuleAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function deleteRule(formData: FormData): Promise<Result> {
    'use server'
    const r = await deleteSourceRuleAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }

  const ruleCount = config.rules.length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone="ok">
          <b>Lead routing.</b> Every new lead goes to a broker by this rule
          {ruleCount > 0 ? `, plus ${ruleCount} source override${ruleCount === 1 ? '' : 's'}.` : '.'}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ marginBottom: 4 }}>
        <Link href="/admin/crm/settings" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          CRM settings
        </Link>
        <Link href="/admin/crm/settings/brokers" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Brokers
        </Link>
      </div>

      <SectionHead>Assignment</SectionHead>
      <RoutingEditor
        strategy={config.strategy}
        defaultBroker={config.defaultBroker}
        rules={config.rules}
        brokers={brokerOptions}
        setStrategyAction={setStrategy}
        setDefaultBrokerAction={setDefaultBroker}
        upsertRuleAction={upsertRule}
        deleteRuleAction={deleteRule}
      />
    </div>
  )
}
