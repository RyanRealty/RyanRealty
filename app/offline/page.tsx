/**
 * /offline - PWA recovery, on the v3 barrel.
 *
 * // @data-free utility page. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet recovery. Minimal. No sales Sheet.
 *
 * VISITOR OBJECTIVE: When the connection, not the site, is the problem, see
 * an honest recoverable state with a retry instead of a raw browser error.
 * MACHINE OBJECTIVE: Keep a network-blipped session recoverable so it returns
 * to the exploration graph instead of dying.
 * EXITS: /
 *
 * P3 lock: PWA offline is minimal recovery only.
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static utility page, no DAL access needed.
import type { Metadata } from 'next'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { TryAgainButton } from './TryAgain.client'

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline. Return when you are back online.',
  robots: 'noindex, nofollow',
}

export default function OfflinePage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Quiet
          id="offline"
          heading="You are offline"
          headingLevel={1}
          items={[
            { kind: 'prose', body: 'This page needs a connection.' },
            { label: 'Go to homepage', href: '/' },
          ]}
        />
        <TryAgainButton />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
