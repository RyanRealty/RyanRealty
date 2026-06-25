// @no-parity — internal admin surface, no public mockup contract
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
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-sm text-muted-foreground">
            <Link href="/admin/crm/settings" className="inline-flex min-h-10 items-center hover:text-foreground">
              Back to settings
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Lead routing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how a new lead is assigned to a broker.
          </p>
        </div>
        <Link href="/admin/crm/settings/brokers" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 sm:h-9">
            Brokers
          </Button>
        </Link>
      </div>

      <ConsoleSection title="Assignment" className="mt-6">
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
      </ConsoleSection>
    </main>
  )
}
