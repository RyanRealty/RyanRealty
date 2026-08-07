/**
 * PortalViewLink — the entry point from the person workspace into the
 * read-only client portal mirror (search-optimization plan Phase 4.3).
 *
 * Navigation only. It renders one link and holds no state, so it is safe in
 * both the desktop engagement rail and the mobile Homes tab, which is why the
 * control lives here once instead of being written twice.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PortalViewLink({ personId, className }: { personId: number; className?: string }) {
  return (
    <Button asChild variant="outline" size="sm" className={cn('w-full justify-center', className)}>
      <Link href={`/admin/people/${personId}/portal`}>Open their portal view (read only)</Link>
    </Button>
  )
}
