// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmGroups } from '@/lib/data/crm/getCrmGroups'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  addGroupMemberAction,
  removeGroupMemberAction,
} from '@/app/actions/crm-groups'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import GroupEditor from '@/components/admin/crm/settings/GroupEditor'

export const metadata = { title: 'Groups | CRM settings | Admin' }
export const dynamic = 'force-dynamic'

type Result = { ok: boolean; error?: string }

export default async function CrmGroupsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [groups, brokers] = await Promise.all([getCrmGroups(), getCrmBrokers()])
  const brokerOptions = brokers.map((b) => ({ slug: b.slug, name: b.name || b.slug }))

  async function create(formData: FormData): Promise<Result> {
    'use server'
    return createGroupAction(formData)
  }
  async function update(formData: FormData): Promise<Result> {
    'use server'
    return updateGroupAction(formData)
  }
  async function del(formData: FormData): Promise<Result> {
    'use server'
    return deleteGroupAction(formData)
  }
  async function addMember(formData: FormData): Promise<Result> {
    'use server'
    return addGroupMemberAction(formData)
  }
  async function removeMember(formData: FormData): Promise<Result> {
    'use server'
    return removeGroupMemberAction(formData)
  }

  return (
    <SettingsSubpageShell
      title="Groups"
      description="Named broker groups used as distribution targets in Lead Flows. Round robin or first to claim."
    >
      <div className="mt-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        A Group is a set of brokers. When a Lead Flow targets a group, leads distribute across its members using the group&apos;s distribution type (round robin or first to claim).
      </div>

      <div className="mt-6">
        {groups.length === 0 && (
          <ConsoleSection title="No groups yet">
            <p className="text-sm text-muted-foreground">Create your first group below.</p>
          </ConsoleSection>
        )}

        <GroupEditor
          groups={groups}
          brokers={brokerOptions}
          createGroupAction={create}
          updateGroupAction={update}
          deleteGroupAction={del}
          addGroupMemberAction={addMember}
          removeGroupMemberAction={removeMember}
        />
      </div>
    </SettingsSubpageShell>
  )
}
