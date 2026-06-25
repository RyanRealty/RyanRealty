// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import {
  createTagAction,
  renameTagAction,
  mergeTagAction,
  deleteTagAction,
  setTagActiveAction,
  reorderTagsAction,
  listCrmTagsAction,
} from '@/app/actions/crm-tags'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { TagTaxonomyEditor, type TagRow } from '@/components/admin/crm/settings/TagTaxonomyEditor'

export const metadata = { title: 'Tags | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmTagsSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  // listCrmTagsAction carries the row id (used by the CRUD actions); getCrmTags
  // carries the live usage count per key. Merge them by key.
  const [list, withUsage] = await Promise.all([listCrmTagsAction(), getCrmTags()])
  const usageByKey = new Map(withUsage.map((t) => [t.key, t.usageCount]))

  const rows: TagRow[] = list.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    position: r.position,
    isActive: r.isActive,
    isProtected: r.isProtected,
    usageCount: usageByKey.get(r.key) ?? 0,
  }))

  return (
    <SettingsSubpageShell
      title="Tags"
      description="The tag taxonomy. Rename a tag everywhere or merge two together across every contact. Compliance tags are locked."
    >
      <TagTaxonomyEditor
        rows={rows}
        actions={{
          create: createTagAction,
          rename: renameTagAction,
          merge: mergeTagAction,
          remove: deleteTagAction,
          setActive: setTagActiveAction,
          reorder: reorderTagsAction,
        }}
      />
    </SettingsSubpageShell>
  )
}
