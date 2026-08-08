// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — the guard, the list-action read, and the five server
// actions are carried over verbatim. ConfigTableEditor now lives in
// _components/ and is shared by three pages (stages, segments, areas).
import Link from 'next/link'
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
import { VerdictLine } from '@/components/admin/v2'
import { ConfigTableEditor, type ConfigEditorRow } from '../_components/ConfigTableEditor'

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
                {rows.length === 1 ? 'segment' : 'segments'} active.
              </b>{' '}
              The audience segments the newsletter targets. Deleting a segment moves every affected
              subscriber to a segment you choose.
            </>
          ) : (
            <>
              <b>No segments yet.</b> Add the first audience segment the newsletter targets.
            </>
          )}
        </VerdictLine>
      </div>

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
    </div>
  )
}
