// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the guard, the list-action read, and the five server
// actions are carried over verbatim. ConfigTableEditor is shared with
// /admin/crm/settings/areas, so it is left untouched here.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  createCrmStageAction,
  renameCrmStageAction,
  reorderCrmStagesAction,
  setCrmStageActiveAction,
  deleteCrmStageAction,
  listCrmStagesAction,
} from '@/app/actions/crm-stages'
import { VerdictLine } from '@/components/admin/v2'
import { ConfigTableEditor, type ConfigEditorRow } from '@/components/admin/crm/settings/ConfigTableEditor'

export const metadata = { title: 'Pipeline stages | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmStagesSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  // The list action passthrough carries the row id (the cached getCrmStages
  // reader omits it; the CRUD actions key on id), so the editor reads from it.
  const rows: ConfigEditorRow[] = (await listCrmStagesAction()).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    position: r.position,
    isActive: r.isActive,
    isProtected: r.isProtected,
  }))
  const live = rows.filter((r) => r.isActive).length

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

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={rows.length ? 'ok' : 'attention'}>
          {rows.length ? (
            <>
              <b>
                {live.toLocaleString('en-US')} of {rows.length.toLocaleString('en-US')}{' '}
                {rows.length === 1 ? 'stage' : 'stages'} active.
              </b>{' '}
              The funnel stages a contact moves through. Deleting a stage moves every affected contact
              to a stage you choose.
            </>
          ) : (
            <>
              <b>No stages yet.</b> Add the first funnel stage a contact moves through.
            </>
          )}
        </VerdictLine>
      </div>

      <ConfigTableEditor
        rows={rows}
        actions={{
          create: createCrmStageAction,
          rename: renameCrmStageAction,
          reorder: reorderCrmStagesAction,
          setActive: setCrmStageActiveAction,
          remove: deleteCrmStageAction,
        }}
        noun="stage"
        dependentNoun="contacts"
        deleteMode="reassign"
      />
    </div>
  )
}
