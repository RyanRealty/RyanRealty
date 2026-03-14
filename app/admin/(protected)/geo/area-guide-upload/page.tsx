import Link from 'next/link'
import AreaGuideUploadClient from './AreaGuideUploadClient'

export const dynamic = 'force-dynamic'

export default function AdminAreaGuideUploadPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Area Guide media upload</h1>
      <p className="mt-2 text-muted-foreground">
        Select the root folder (e.g. Area Guides). The system browses the file structure and finds all photos and videos whether they sit in place-named folders, in nested <strong>photos/</strong> or <strong>videos/</strong> folders, or in top-level <strong>photos/PlaceName/</strong> or <strong>videos/PlaceName/</strong>. Each place is mapped to the correct city, neighborhood, or subdivision.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/admin/geo" className="underline">← Geography &amp; Neighborhoods</Link>
        {' · '}
        <Link href="/admin" className="underline">Admin</Link>
      </p>
      <AreaGuideUploadClient />
    </main>
  )
}
