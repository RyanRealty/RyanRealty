import type { Metadata } from 'next'

import { getRegionPulse } from '@/lib/data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import '@/components/site/kb/kb.css'

/**
 * KB homepage — PREVIEW route. The kinetic-brutalist homepage built for real,
 * section by section, before it promotes to app/page.tsx. noindex so it never
 * competes with the live homepage in search. Live data via the DAL (§0).
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'KB Homepage (preview)',
  robots: { index: false, follow: false },
}

export default async function KbHomePreview() {
  const pulse = await getRegionPulse().catch(() => null)

  return (
    <main className="kb-root">
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
        />
      </SmoothScrollProvider>
    </main>
  )
}
