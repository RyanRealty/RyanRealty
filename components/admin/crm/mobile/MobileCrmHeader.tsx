'use client'

/**
 * MobileCrmHeader — the §24 §1.3 navy header bar shared by the mobile CRM
 * root surfaces (People `/admin/crm`, Activity `/admin/crm/activity`), matching
 * the language the Calendar (§29 A.3) and Inbox (§26) mobile headers already
 * use so every root reads as ONE app (Matt punch list #3, 2026-07-02).
 *
 * Anatomy (56px, bg-primary):
 *   left   — 36pt broker headshot → /admin/settings
 *   center — the scope control ("Everyone ▾" BrokerScopeSheet trigger) or a
 *            plain 17pt white title
 *   right  — search: either an inline toggle revealing `searchSlot` below the
 *            bar (People) or a plain link (Activity → People search)
 */

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'

export default function MobileCrmHeader({
  brokerName,
  brokerHeadshot,
  center,
  searchSlot,
  searchHref,
  searchOpenInitially = false,
}: {
  brokerName: string
  brokerHeadshot: string | null
  /** Center control — a BrokerScopeSheet header-variant trigger or a title. */
  center: React.ReactNode
  /** Inline search row revealed under the bar when the icon is tapped. */
  searchSlot?: React.ReactNode
  /** Alternative: navigate on tap (used where search lives elsewhere). */
  searchHref?: string
  /** Open the search row on mount (e.g. a ?q= filter is active). */
  searchOpenInitially?: boolean
}) {
  const [searchOpen, setSearchOpen] = useState(searchOpenInitially)

  return (
    <div className="bg-primary">
      <div className="flex h-14 items-center px-4">
        <Link href="/admin/settings" aria-label="Your settings" className="shrink-0">
          <CrmAvatar name={brokerName} src={brokerHeadshot} size={36} className="bg-white/20" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">{center}</div>
        <div className="flex w-9 shrink-0 items-center justify-end">
          {searchSlot ? (
            <button
              type="button"
              aria-label={searchOpen ? 'Hide search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search className="h-[22px] w-[22px] text-primary-foreground" strokeWidth={1.8} aria-hidden />
            </button>
          ) : searchHref ? (
            <Link href={searchHref} aria-label="Search">
              <Search className="h-[22px] w-[22px] text-primary-foreground" strokeWidth={1.8} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      {searchSlot && searchOpen ? <div className="px-4 pb-3">{searchSlot}</div> : null}
    </div>
  )
}
