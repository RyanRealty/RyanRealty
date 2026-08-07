// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the guard, the reader, and the four server actions are
// carried over verbatim from the pre-migration page. The editor island
// (CustomFieldEditor) stays as-is: it is a legacy client surface that migrates
// with its own unit.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import {
  createCrmFieldDefinitionAction,
  updateCrmFieldDefinitionAction,
  reorderCrmFieldDefinitionsAction,
  deleteCrmFieldDefinitionAction,
} from '@/app/actions/crm-field-definitions'
import { VerdictLine } from '@/components/admin/v2'
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
                {rows.length.toLocaleString('en-US')} custom {rows.length === 1 ? 'field' : 'fields'}.
              </b>{' '}
              The typed fields on the contact card Details section and the saved-view filter builder.
              Removing a field keeps the stored values.
            </>
          ) : (
            <>
              <b>No custom fields yet.</b> Add the first one to extend the contact card Details section
              and the saved-view filter builder.
            </>
          )}
        </VerdictLine>
      </div>

      <CustomFieldEditor
        rows={rows}
        actions={{
          create: createCrmFieldDefinitionAction,
          update: updateCrmFieldDefinitionAction,
          reorder: reorderCrmFieldDefinitionsAction,
          remove: deleteCrmFieldDefinitionAction,
        }}
      />
    </div>
  )
}
