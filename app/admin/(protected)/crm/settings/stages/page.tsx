// @no-parity — internal admin surface, no public mockup contract
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
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
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

  return (
    <SettingsSubpageShell
      title="Pipeline stages"
      description="The funnel stages a contact moves through. Deleting a stage moves every affected contact to a stage you choose."
    >
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
    </SettingsSubpageShell>
  )
}
