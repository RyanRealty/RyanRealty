// @no-parity — internal admin surface, no public mockup contract
//
// Area Guide media upload — migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: the superuser guard (this folder's layout.tsx,
// untouched), `export const dynamic = 'force-dynamic'`, the folder-structure
// copy word for word (it is the contract the uploader reads), and both the
// /admin/geo and /admin hrefs. AreaGuideUploadClient is mounted unchanged —
// it owns the picker, the scan and the upload, and migrates with its own unit.
//
// Shape changed, data did not: the page no longer renders its own <main>
// (ConsoleShell owns that landmark — this page shipped two of them), and the
// <h1> is gone because the geo tab strip now names this page.
import Link from 'next/link'
import { SectionHead } from '@/components/admin/v2'
import AreaGuideUploadClient from './AreaGuideUploadClient'

export const dynamic = 'force-dynamic'

export default function AdminAreaGuideUploadPage() {
  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        className="av2-wordrow"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/geo" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          ← Geography &amp; Neighborhoods
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/admin" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Admin
        </Link>
      </nav>

      <SectionHead>Folder structure</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Select the root folder (e.g. Area Guides). The system browses the file structure and finds
        all photos and videos whether they sit in place-named folders, in nested{' '}
        <strong>photos/</strong> or <strong>videos/</strong> folders, or in top-level{' '}
        <strong>photos/PlaceName/</strong> or <strong>videos/PlaceName/</strong>. Each place is
        mapped to the correct city, neighborhood, or subdivision.
      </p>

      <AreaGuideUploadClient />
    </div>
  )
}
