/**
 * PortalViewLink — the entry point from the person workspace into the
 * read-only client portal mirror (search-optimization plan Phase 4.3).
 *
 * Navigation only. It renders one link and holds no state, so it is safe in
 * both the desktop engagement rail and the mobile Homes tab, which is why the
 * control lives here once instead of being written twice.
 *
 * Admin v2 (11F): the shadcn `Button asChild` wrapper is gone. The v2 Button
 * always renders a real button element and has no asChild escape hatch, so a
 * NAVIGATION control keeps its anchor and wears the av2-btn classes directly —
 * the same call SubscriberFilters records for its download link, and the only
 * one that keeps middle-click and Cmd/Ctrl-click working. The classes (never an
 * inline background) so .av2-btn--quiet:hover still fires.
 */

import Link from 'next/link'
import '@/components/admin/v2/admin-v2.css'
import { cn } from '@/lib/utils'

export function PortalViewLink({ personId, className }: { personId: number; className?: string }) {
  return (
    <Link
      href={`/admin/people/${personId}/portal`}
      className={cn('av2-btn av2-btn--quiet w-full justify-center', className)}
      style={{ textDecoration: 'none' }}
    >
      Open their portal view (read only)
    </Link>
  )
}
