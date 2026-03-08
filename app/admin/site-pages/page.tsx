import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function AdminSitePagesPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Site pages</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Editable content for public pages (e.g. About). Edit in Supabase until the edit UI is built.
      </p>
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <ul className="space-y-2 text-sm">
          <li>
            <strong>About</strong> — key <code className="rounded bg-zinc-100 px-1">about</code> in <code className="rounded bg-zinc-100 px-1">site_pages</code>. Columns: <code className="rounded bg-zinc-100 px-1">title</code>, <code className="rounded bg-zinc-100 px-1">body_html</code>.
          </li>
        </ul>
        <Link href="/about" className="mt-4 inline-block text-sm text-emerald-600 hover:underline" target="_blank" rel="noopener">
          View About page →
        </Link>
      </div>
    </main>
  )
}
