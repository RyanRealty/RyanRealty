// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import {
  createCrmFieldDefinitionAction,
  updateCrmFieldDefinitionAction,
  reorderCrmFieldDefinitionsAction,
  deleteCrmFieldDefinitionAction,
} from '@/app/actions/crm-field-definitions'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { CustomFieldEditor, type FieldRow } from '@/components/admin/crm/settings/CustomFieldEditor'

export const metadata = { title: 'Custom fields | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmCustomFieldsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const defs = await getCrmFieldDefinitions()
  const rows: FieldRow[] = defs.map((d) => ({
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: d.options,
    position: d.position,
    hideIfEmpty: d.hideIfEmpty,
    readOnly: d.readOnly,
    fieldGroup: d.fieldGroup,
    isProtected: d.isProtected,
  }))

  return (
    <SettingsSubpageShell
      title="Custom fields"
      description="The typed fields on the contact card Details section and the saved-view filter builder. Removing a field keeps the stored values."
    >
      <CustomFieldEditor
        rows={rows}
        actions={{
          create: createCrmFieldDefinitionAction,
          update: updateCrmFieldDefinitionAction,
          reorder: reorderCrmFieldDefinitionsAction,
          remove: deleteCrmFieldDefinitionAction,
        }}
      />
    </SettingsSubpageShell>
  )
}
