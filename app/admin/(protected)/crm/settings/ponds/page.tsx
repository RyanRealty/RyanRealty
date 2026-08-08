// @no-parity — internal admin surface, no public mockup contract
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the owner-only guard, the five server-action wrappers, and
// the PondEditor contract are carried over verbatim. PondEditor itself is
// sanctioned legacy machinery (exclusively owned by this route; it migrates with
// a later unit).
import Link from 'next/link'
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
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import PondEditor from '@/app/admin/(protected)/crm/settings/_components/PondEditor'

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
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone={ponds.length === 0 ? 'attention' : 'ok'}>
          {ponds.length === 0 ? (
            <>
              <b>No ponds yet.</b> Nothing can hold an unassigned lead for a broker to claim.
            </>
          ) : (
            <>
              <b>
                {ponds.length} pond{ponds.length === 1 ? '' : 's'}.
              </b>{' '}
              Holding queues where unassigned leads wait until a broker claims them.
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
        When a Lead Flow routes a lead to a pond, the lead stays unassigned until one of the pond&apos;s members
        claims it. Any member can claim any lead in a pond they belong to.
      </p>

      <SectionHead>Ponds</SectionHead>
      {ponds.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
          Create your first pond below.
        </p>
      ) : null}

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
  )
}
