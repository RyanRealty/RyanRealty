// @no-parity — internal admin surface, no public mockup contract
//
// /admin/media/banners — the missing-banner queue. 11C: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: the unstable_cache wrapper around listMissingBanners
// (same ['admin-missing-banners'] key, same 300s revalidate, same
// ['admin-banners'] tag) and the comment explaining why it exists,
// `dynamic = 'force-dynamic'`, the 20-row display cap and its "… and N more"
// remainder, the <GenerateBannersButton generateAction={generateAllMissingBanners} />
// mount (the island is untouched — it migrates with its own unit), the
// /admin/sync href, and the env-var setup notes word for word. The superuser
// guard lives in banners/layout.tsx and was not touched.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the main landmark), the page-title <h1> is gone (the nav names the page), the
// bordered count card became the verdict line, the bulleted missing list became
// the family's ReportGrid — which gives the empty case a real state instead of
// a silently absent list — and the setup notes moved below the action they
// explain. The 768px (48rem) page width is preserved as an inline maxWidth
// instead of a Tailwind width token.
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { listMissingBanners, generateAllMissingBanners } from '@/app/actions/banners'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
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

const COLUMNS: ReportColumn[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City' },
]

/** Inline literal (env var, route, bucket name) in the setup notes. */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'var(--a-font-mono)',
        background: 'var(--a-inset)',
        borderRadius: 'var(--a-r-sm)',
        padding: '1px 4px',
      }}
    >
      {children}
    </code>
  )
}

export default async function BannersPage() {
  const missing = await getMissingBanners()

  const cityCount = missing.filter((m) => m.entityType === 'city').length
  const subdivisionCount = missing.length - cityCount

  // Same 20-row cap the bulleted list carried, same remainder line.
  const shown = missing.slice(0, 20)
  const remainder = missing.length - shown.length

  const rows: ReportGridRow[] = shown.map((m) => ({
    key: `${m.entityType}:${m.entityKey}`,
    cells: [
      m.entityType,
      m.displayName,
      m.entityType === 'subdivision' ? (m.city ?? '—') : '—',
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 768, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={missing.length > 0 ? 'attention' : 'ok'}>
          {missing.length > 0 ? (
            <>
              <b>
                {missing.length.toLocaleString('en-US')}{' '}
                {missing.length === 1 ? 'place has' : 'places have'} no banner.
              </b>{' '}
              {cityCount.toLocaleString('en-US')}{' '}
              {cityCount === 1 ? 'city' : 'cities'} ·{' '}
              {subdivisionCount.toLocaleString('en-US')}{' '}
              {subdivisionCount === 1 ? 'subdivision' : 'subdivisions'}.
            </>
          ) : (
            <>
              <b>Every city and subdivision has a banner.</b> Nothing to generate.
            </>
          )}
        </VerdictLine>
      </div>

      <GenerateBannersButton generateAction={generateAllMissingBanners} />

      <SectionHead>Missing banners</SectionHead>
      <ReportGrid
        label="Places with no banner image"
        columns={COLUMNS}
        template="minmax(96px, 0.6fr) minmax(160px, 1.4fr) minmax(120px, 1fr)"
        minWidth={420}
        rows={rows}
        empty={<>None.</>}
      />
      {remainder > 0 ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 8 }}>
          … and {remainder.toLocaleString('en-US')} more. Generating covers every missing banner,
          not just the ones listed here.
        </p>
      ) : null}

      <SectionHead>Setup</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
        Hero banners from Unsplash (search by city or community). Set{' '}
        <Code>UNSPLASH_ACCESS_KEY</Code> in .env.local (and in Vercel for production). Optional:{' '}
        <Code>SHUTTERSTOCK_API_KEY</Code> + <Code>SHUTTERSTOCK_API_SECRET</Code> for licensed
        previews via <Code>GET /api/admin/stock/unsplash/search</Code>,{' '}
        <Code>GET /api/admin/stock/pexels/search</Code>, and{' '}
        <Code>GET /api/admin/stock/shutterstock/search</Code> (admin session, preview URLs only).
        UI:{' '}
        <Link href="/admin/media/stock-photos" style={{ color: 'var(--a-accent)' }}>
          /admin/media/stock-photos
        </Link>
        . Generate once; the same URL is used on web and mobile. Create a <strong>public</strong>{' '}
        Storage bucket named <Code>banners</Code> in Supabase Dashboard → Storage if you haven’t.
      </p>

      <div className="av2-wordrow" style={{ marginTop: 20 }}>
        <Link href="/admin/sync" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Back to Sync
        </Link>
      </div>
    </div>
  )
}
