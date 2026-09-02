'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { AdminPlatformUserRow } from '@/app/actions/admin-roles'
import { Button, ReportGrid, SearchField, SectionHead } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'

/**
 * AdminUsersList — registered platform-user (site signup) viewer, on the
 * admin-v2 language (migrated 2026-09-01 — the last live admin surface off
 * the pre-v2 shadcn table primitive, which wrote every field twice as mobile cards +
 * a desktop table; ReportGrid owns responsiveness itself). Names are doors:
 * each row links to the CRM list searched by that user's email.
 *
 * Consolidation 2026-07-15: the admin_roles manager that used to live here
 * (add/update/remove access) moved to /admin/crm/settings/team, which reuses
 * the same upsertAdminRole / removeAdminRole server actions via
 * components/admin/crm/settings/TeamRoleManager.tsx.
 */

type Props = {
  users?: AdminPlatformUserRow[]
}

// Curate, never dump: cap the on-page registered-users list. Search expands it.
const USERS_PREVIEW_CAP = 6

function userName(user: AdminPlatformUserRow): string {
  return user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '—'
}

export default function AdminUsersList({ users = [] }: Props) {
  const [userSearch, setUserSearch] = useState('')
  const [showAllUsers, setShowAllUsers] = useState(false)

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => {
      const haystack = [
        user.email ?? '',
        user.display_name ?? '',
        user.first_name ?? '',
        user.last_name ?? '',
        user.phone ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [users, userSearch])

  const isSearching = userSearch.trim().length > 0
  // When searching, show every match; otherwise cap until "See all" is tapped.
  const visibleUsers = isSearching || showAllUsers ? filteredUsers : filteredUsers.slice(0, USERS_PREVIEW_CAP)
  const hiddenUserCount = filteredUsers.length - visibleUsers.length

  return (
    <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <SectionHead>Registered users ({users.length})</SectionHead>
        <div style={{ minWidth: 260 }}>
          <SearchField
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by name, email, or phone"
            aria-label="Search registered users"
          />
        </div>
      </div>

      <ReportGrid
        label="Registered users"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'saved', label: 'Saved', numeric: true },
          { key: 'searches', label: 'Searches', numeric: true },
          { key: 'activity', label: 'Activity', numeric: true },
          { key: 'created', label: 'Created' },
        ]}
        template="1.2fr 1.6fr 0.5fr 0.6fr 0.6fr 0.8fr"
        minWidth={720}
        rows={visibleUsers.map((user) => ({
          key: user.id,
          cells: [
            user.email ? (
              <Link key="name" href={`/admin/crm?q=${encodeURIComponent(user.email)}`} style={{ color: 'var(--a-accent)' }}>
                {userName(user)}
              </Link>
            ) : (
              userName(user)
            ),
            user.email ?? '—',
            user.saved_listings_count,
            user.saved_searches_count,
            user.activities_count,
            formatDate(user.created_at),
          ],
        }))}
        empty={isSearching ? 'No users match your search.' : 'No registered users yet. Site signups land here.'}
      />

      {!isSearching && hiddenUserCount > 0 ? (
        <Button type="button" variant="quiet" onClick={() => setShowAllUsers(true)}>
          See all {filteredUsers.length} users
        </Button>
      ) : null}
      {!isSearching && showAllUsers && filteredUsers.length > USERS_PREVIEW_CAP ? (
        <Button type="button" variant="quiet" onClick={() => setShowAllUsers(false)}>
          Show less
        </Button>
      ) : null}
    </div>
  )
}
