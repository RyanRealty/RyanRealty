// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmPonds } from '@/lib/data/crm/getCrmPonds'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  createPondAction,
  updatePondAction,
  deletePondAction,
  addPondMemberAction,
  removePondMemberAction,
} from '@/app/actions/crm-ponds'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import PondEditor from '@/components/admin/crm/settings/PondEditor'

export const metadata = { title: 'Ponds | CRM settings | Admin' }
export const dynamic = 'force-dynamic'

type Result = { ok: boolean; error?: string }

export default async function CrmPondsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [ponds, brokers] = await Promise.all([getCrmPonds(), getCrmBrokers()])
  const brokerOptions = brokers.map((b) => ({ slug: b.slug, name: b.name || b.slug }))

  async function create(formData: FormData): Promise<Result> {
    'use server'
    return createPondAction(formData)
  }
  async function update(formData: FormData): Promise<Result> {
    'use server'
    return updatePondAction(formData)
  }
  async function del(formData: FormData): Promise<Result> {
    'use server'
    return deletePondAction(formData)
  }
  async function addMember(formData: FormData): Promise<Result> {
    'use server'
    return addPondMemberAction(formData)
  }
  async function removeMember(formData: FormData): Promise<Result> {
    'use server'
    return removePondMemberAction(formData)
  }

  return (
    <SettingsSubpageShell
      title="Ponds"
      description="Holding queues where unassigned leads wait until a broker claims them."
    >
      <div className="mt-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        When a Lead Flow routes a lead to a pond, the lead stays unassigned until one of the pond&apos;s members claims it. Any member can claim any lead in a pond they belong to.
      </div>

      <div className="mt-6">
        {ponds.length === 0 && (
          <ConsoleSection title="No ponds yet">
            <p className="text-sm text-muted-foreground">Create your first pond below.</p>
          </ConsoleSection>
        )}

        <PondEditor
          ponds={ponds}
          brokers={brokerOptions}
          createPondAction={create}
          updatePondAction={update}
          deletePondAction={del}
          addPondMemberAction={addMember}
          removePondMemberAction={removeMember}
        />
      </div>
    </SettingsSubpageShell>
  )
}
