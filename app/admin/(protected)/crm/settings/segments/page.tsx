// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  createCrmNewsletterSegmentAction,
  renameCrmNewsletterSegmentAction,
  reorderCrmNewsletterSegmentsAction,
  setCrmNewsletterSegmentActiveAction,
  deleteCrmNewsletterSegmentAction,
  listCrmNewsletterSegmentsAction,
} from '@/app/actions/crm-newsletter-segments'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { ConfigTableEditor, type ConfigEditorRow } from '@/components/admin/crm/settings/ConfigTableEditor'

export const metadata = { title: 'Newsletter segments | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmSegmentsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const rows: ConfigEditorRow[] = (await listCrmNewsletterSegmentsAction()).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    position: r.position,
    isActive: r.isActive,
    isProtected: r.isProtected,
  }))

  return (
    <SettingsSubpageShell
      title="Newsletter segments"
      description="The audience segments the newsletter targets. Deleting a segment moves every affected subscriber to a segment you choose."
    >
      <ConfigTableEditor
        rows={rows}
        actions={{
          create: createCrmNewsletterSegmentAction,
          rename: renameCrmNewsletterSegmentAction,
          reorder: reorderCrmNewsletterSegmentsAction,
          setActive: setCrmNewsletterSegmentActiveAction,
          remove: deleteCrmNewsletterSegmentAction,
        }}
        noun="segment"
        dependentNoun="subscribers"
        deleteMode="reassign"
      />
    </SettingsSubpageShell>
  )
}
