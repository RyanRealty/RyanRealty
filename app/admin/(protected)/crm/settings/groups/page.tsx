// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the guard, both reads, and the five 'use server' action
// wrappers are carried over verbatim. GroupEditor is a legacy client island
// that migrates with its own unit.
import Link from 'next/link'
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
import { VerdictLine } from '@/components/admin/v2'
import GroupEditor from '@/app/admin/(protected)/crm/settings/_components/GroupEditor'

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
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CRM settings
        </Link>
      </nav>

      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone={groups.length ? 'ok' : 'attention'}>
          {groups.length ? (
            <>
              <b>
                {groups.length.toLocaleString('en-US')} broker{' '}
                {groups.length === 1 ? 'group' : 'groups'}.
              </b>{' '}
              Distribution targets in{' '}
              <Link href="/admin/crm/settings/lead-flows" style={{ color: 'var(--a-accent)' }}>
                Lead flows
              </Link>
              . Round robin or first to claim.
            </>
          ) : (
            <>
              <b>No groups yet.</b> Create your first group below, then point a{' '}
              <Link href="/admin/crm/settings/lead-flows" style={{ color: 'var(--a-accent)' }}>
                lead flow
              </Link>{' '}
              at it.
            </>
          )}
        </VerdictLine>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        A group is a set of brokers. When a lead flow targets a group, leads distribute across its
        members using the group&apos;s distribution type — round robin or first to claim.
      </p>

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
  )
}
