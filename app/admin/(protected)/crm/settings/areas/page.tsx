// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  createCrmReportAreaAction,
  renameCrmReportAreaAction,
  reorderCrmReportAreasAction,
  setCrmReportAreaActiveAction,
  deleteCrmReportAreaAction,
  listCrmReportAreasAction,
} from '@/app/actions/crm-report-areas'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { ConfigTableEditor, type ConfigEditorRow } from '@/components/admin/crm/settings/ConfigTableEditor'

export const metadata = { title: 'Market-report areas | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmAreasSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const rows: ConfigEditorRow[] = (await listCrmReportAreasAction()).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    position: r.position,
    isActive: r.isActive,
    isProtected: r.isProtected,
  }))

  return (
    <SettingsSubpageShell
      title="Market-report areas"
      description="The areas a contact can subscribe to market reports for. Deleting an area scrubs it from every subscription that references it."
    >
      <ConfigTableEditor
        rows={rows}
        actions={{
          create: createCrmReportAreaAction,
          rename: renameCrmReportAreaAction,
          reorder: reorderCrmReportAreasAction,
          setActive: setCrmReportAreaActiveAction,
          remove: deleteCrmReportAreaAction,
        }}
        noun="area"
        dependentNoun="subscriptions"
        deleteMode="scrub"
      />
    </SettingsSubpageShell>
  )
}
