'use client'

import { useMemo, useState } from 'react'
import type { AdminPlatformUserRow } from '@/app/actions/admin-roles'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * AdminUsersList — registered platform-user (site signup) viewer.
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
    <div className="mt-6 space-y-6">
      {/* Registered users */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Registered users{' '}
            <span className="font-normal text-muted-foreground tabular-nums">({users.length})</span>
          </h2>
          <Input
            type="search"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search by name, email, or phone"
            className="h-11 w-full sm:w-80"
          />
        </div>

        {/* phones */}
        <div className="space-y-2 md:hidden">
          {visibleUsers.length === 0 ? (
            <EmptyCard
              message={isSearching ? 'No users match your search.' : 'No registered users yet.'}
            />
          ) : (
            visibleUsers.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{user.email ?? '—'}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Saved <span className="tabular-nums text-foreground">{user.saved_listings_count}</span></span>
                    <span>Searches <span className="tabular-nums text-foreground">{user.saved_searches_count}</span></span>
                    <span>Activity <span className="tabular-nums text-foreground">{user.activities_count}</span></span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* desktop */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Saved</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Searches</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Activity</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {isSearching ? 'No users match your search.' : 'No registered users yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-sm text-foreground">
                      {user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email ?? '—'}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{user.saved_listings_count}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{user.saved_searches_count}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{user.activities_count}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* See all / show less — only when capped (not while searching) */}
        {!isSearching && hiddenUserCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAllUsers(true)}
            className="h-11 w-full"
          >
            See all {filteredUsers.length} users →
          </Button>
        )}
        {!isSearching && showAllUsers && filteredUsers.length > USERS_PREVIEW_CAP && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAllUsers(false)}
            className="h-11 w-full"
          >
            Show less
          </Button>
        )}
      </section>
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  )
}
