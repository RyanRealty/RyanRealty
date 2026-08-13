// @no-parity — private /account subtree page (no public mockup contract; matches
// the sibling /account/saved-searches composition, not a ui_kits mockup)
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { listAreasForUser } from '@/lib/data'
import AreaControls, { type AreaListRow } from '@/components/account/areas/AreaControls'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listingsBrowsePath } from '@/lib/slug'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'

export const metadata: Metadata = {
  title: 'My areas',
  description: 'Your saved map areas at Ryan Realty.',
}

export default async function AreasPage() {
  const supabase = await createClient()
  const { data: { user } = { user: null } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [areas, admin] = await Promise.all([
    listAreasForUser(user.id),
    getAdminContext(),
  ])
  const isBroker = admin?.role === 'superuser' || admin?.role === 'broker'

  const rows: AreaListRow[] = areas.map((area) => ({
    id: area.id,
    name: area.name,
    slug: area.slug,
    shapes: area.shapes,
    is_public: area.is_public,
    updated_at: area.updated_at,
  }))

  return (
    <AccountFrame>
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">My areas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Named map areas you drew on the search map, ready to reuse in any search or alert.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Draw a new area</Link>
        </Button>
      </header>

      {/* ── Areas ── */}
      <section>
        {rows.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved areas yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Draw shapes on the search map and save them as a named area, like Bend west side.
              Then reuse it across searches and alerts.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Open the search map</Link>
            </Button>
          </Card>
        ) : (
          <AreaControls areas={rows} isBroker={isBroker} />
        )}
      </section>
    </div>
    </AccountFrame>
  )
}
