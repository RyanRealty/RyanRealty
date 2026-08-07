// @no-parity — internal admin surface, no public mockup contract
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the owner-only guard, the read, and the five actions handed
// to ConfigTableEditor are carried over verbatim. ConfigTableEditor is SHARED with
// /stages and /segments (and with TagTaxonomyEditor + CustomFieldEditor), so it is
// left untouched here and migrates once, with the family.
import Link from 'next/link'
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
import { SectionHead, VerdictLine } from '@/components/admin/v2'
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

  const active = rows.filter((r) => r.isActive).length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone={rows.length === 0 ? 'attention' : 'ok'}>
          {rows.length === 0 ? (
            <>
              <b>No market-report areas yet.</b> A contact has nothing to subscribe to.
            </>
          ) : (
            <>
              <b>
                {active} of {rows.length} area{rows.length === 1 ? '' : 's'} live.
              </b>{' '}
              These are the areas a contact can subscribe to market reports for.
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
        Deleting an area scrubs it from every subscription that references it.
      </p>

      <SectionHead>Areas</SectionHead>
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
    </div>
  )
}
