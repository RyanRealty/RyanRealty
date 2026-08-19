/**
 * Global 404. PublicNav still provides the header. Do not remount V3Chrome.
 *
 * 404s render at any pathname. HideChrome still gates footer visibility
 * (LP/admin hide). This is the one surface that still ships a footer behind
 * HideChrome. 404s are never indexed. Real pages render footer server-side
 * (scripts/check-default-chrome-footer.mjs).
 *
 * Leftover NotFoundClient island keeps the path-aware recovery body.
 * Do not rebuild it this lease.
 *
 * D11: no virtue names. No invented quote. Who is talking: We.
 */

import type { Metadata } from 'next'
import { NotFoundClient } from '@/components/NotFoundClient'
import { HideChrome } from '@/components/layout/HideOnLP'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist or was moved.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Page not found',
    description: 'This page does not exist or was moved.',
    url: undefined,
    type: 'website',
  },
}

export default function NotFound() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
          <NotFoundClient />
        </div>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. HideChrome keeps this off LP/admin paths. */}
      <HideChrome>
        <V3Footer columns={V3_FOOTER_COLUMNS} />
      </HideChrome>
    </>
  )
}
