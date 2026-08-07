// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the guard, both reads (listCrmTagsAction for ids,
// getCrmTags for live usage counts), and the six server actions are carried
// over verbatim. The TagTaxonomyEditor island migrates with its own unit.
import Link from 'next/link'
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
import { VerdictLine } from '@/components/admin/v2'
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
  const unused = rows.filter((r) => r.usageCount === 0).length

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
                {rows.length.toLocaleString('en-US')} {rows.length === 1 ? 'tag' : 'tags'}
                {unused ? `, ${unused.toLocaleString('en-US')} on nobody` : ''}.
              </b>{' '}
              Rename a tag everywhere or merge two together across every contact. Compliance tags are
              locked.
            </>
          ) : (
            <>
              <b>No tags yet.</b> Add the first label the taxonomy governs.
            </>
          )}
        </VerdictLine>
      </div>

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
    </div>
  )
}
