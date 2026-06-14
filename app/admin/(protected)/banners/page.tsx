import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { listMissingBanners, generateAllMissingBanners } from '@/app/actions/banners'
import GenerateBannersButton from './GenerateBannersButton'

/** Avoid long-running work at build time (listMissingBanners can be slow). */
export const dynamic = 'force-dynamic'

// listMissingBanners scans listings per city to compute the missing-banner
// set — slow enough to read as "admin is down" on a phone on a cold render.
// It uses only the anon Supabase client + cached helpers (no cookies inside),
// so the result is globally cacheable. unstable_cache serves stale while
// revalidating: only a cold start ever pays the full scan.
const getMissingBanners = unstable_cache(
  async () => listMissingBanners(),
  ['admin-missing-banners'],
  { revalidate: 300, tags: ['admin-banners'] }
)

export default async function BannersPage() {
  const missing = await getMissingBanners()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Banner images</h1>
      <p className="mt-2 text-muted-foreground">
        Hero banners from Unsplash (search by city or community). Set <code className="rounded bg-muted px-1">UNSPLASH_ACCESS_KEY</code> in .env.local (and in Vercel for production). Optional: <code className="rounded bg-muted px-1">SHUTTERSTOCK_API_KEY</code> + <code className="rounded bg-muted px-1">SHUTTERSTOCK_API_SECRET</code> for licensed previews via{' '}
          <code className="rounded bg-muted px-1">GET /api/admin/stock/unsplash/search</code>,{' '}
          <code className="rounded bg-muted px-1">GET /api/admin/stock/pexels/search</code>, and{' '}
          <code className="rounded bg-muted px-1">GET /api/admin/stock/shutterstock/search</code> (admin session, preview URLs only). UI: <code className="rounded bg-muted px-1">/admin/stock-photos</code>. Generate once; the same URL is used on web and mobile. Create a <strong>public</strong> Storage bucket named <code className="rounded bg-muted px-1">banners</code> in Supabase Dashboard → Storage if you haven’t.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-muted p-4">
        <p className="text-sm font-medium text-muted-foreground">Missing banners</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{missing.length}</p>
        {missing.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {missing.slice(0, 20).map((m) => (
              <li key={`${m.entityType}:${m.entityKey}`}>
                {m.entityType}: {m.displayName}
                {m.entityType === 'subdivision' && ` (${m.city})`}
              </li>
            ))}
            {missing.length > 20 && <li>… and {missing.length - 20} more</li>}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <GenerateBannersButton generateAction={generateAllMissingBanners} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/admin/sync" className="underline hover:no-underline">Back to Sync</Link>
      </p>
    </main>
  )
}
