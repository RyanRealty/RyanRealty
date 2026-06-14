'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminPlatformUserRow, AdminRoleRow, AdminRoleType } from '@/app/actions/admin-roles'
import type { BrokerRow } from '@/app/actions/brokers'
import { upsertAdminRole, removeAdminRole } from '@/app/actions/admin-roles'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Props = {
  initialRoles?: AdminRoleRow[]
  brokers?: BrokerRow[]
  users?: AdminPlatformUserRow[]
}

const ROLE_LABELS: Record<AdminRoleType, string> = {
  superuser: 'Superuser',
  broker: 'Broker',
  report_viewer: 'Report viewer',
}

const ROLE_VARIANT: Record<AdminRoleType, 'default' | 'soft-trending' | 'soft-neutral'> = {
  superuser: 'default',
  broker: 'soft-trending',
  report_viewer: 'soft-neutral',
}

// Curate, never dump: cap the on-page registered-users list. Search expands it.
const USERS_PREVIEW_CAP = 6

export default function AdminUsersList({ initialRoles = [], brokers = [], users = [] }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRoleType>('report_viewer')
  const [brokerId, setBrokerId] = useState<string>('')
  const [userSearch, setUserSearch] = useState('')
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const brokerName = useMemo(() => {
    const map = new Map(brokers.map((b) => [b.id, b.display_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [brokers])

  const roleCounts = useMemo(() => {
    return initialRoles.reduce(
      (acc, r) => {
        acc[r.role] = (acc[r.role] ?? 0) + 1
        return acc
      },
      {} as Record<AdminRoleType, number>,
    )
  }, [initialRoles])

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!email.trim()) {
      setMessage({ type: 'err', text: 'Enter an email' })
      return
    }
    setLoading(true)
    const result = await upsertAdminRole(email.trim(), role, brokerId || null)
    setLoading(false)
    if (result.ok) {
      setMessage({ type: 'ok', text: 'User added or updated.' })
      setEmail('')
      setBrokerId('')
      router.refresh()
      return
    }
    setMessage({ type: 'err', text: result.error })
  }

  async function handleRemove(rowEmail: string) {
    if (!confirm(`Remove admin access for ${rowEmail}?`)) return
    setMessage(null)
    setLoading(true)
    const result = await removeAdminRole(rowEmail)
    setLoading(false)
    if (result.ok) {
      setMessage({ type: 'ok', text: 'User removed.' })
      router.refresh()
      return
    }
    setMessage({ type: 'err', text: result.error })
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Summary before detail: glanceable counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Admin users" value={initialRoles.length} />
        <SummaryStat label="Superusers" value={roleCounts.superuser ?? 0} />
        <SummaryStat label="Brokers" value={roleCounts.broker ?? 0} />
        <SummaryStat label="Registered" value={users.length} />
      </div>

      {/* Add user — the one primary action */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Add or update access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            They must sign in with this Google account to get in.
          </p>
          <form onSubmit={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-email" className="text-xs font-medium text-muted-foreground">
                Email (Google account)
              </Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="h-11 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-xs font-medium text-muted-foreground">
                Role
              </Label>
              <Select value={role} onValueChange={(value) => setRole(value as AdminRoleType)}>
                <SelectTrigger id="user-role" className="h-11 w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="report_viewer">Report viewer (reports only)</SelectItem>
                  <SelectItem value="broker">Broker (profile + reviews)</SelectItem>
                  <SelectItem value="superuser">Superuser (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === 'broker' && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="user-broker" className="text-xs font-medium text-muted-foreground">
                  Broker profile
                </Label>
                <Select value={brokerId} onValueChange={setBrokerId}>
                  <SelectTrigger id="user-broker" className="h-11 w-full">
                    <SelectValue placeholder="Select a broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} className="h-11 w-full sm:w-auto">
                {loading ? 'Adding…' : 'Add user'}
              </Button>
            </div>
          </form>
          {message && (
            <p
              className={
                message.type === 'ok'
                  ? 'mt-3 text-sm text-success'
                  : 'mt-3 text-sm text-destructive'
              }
            >
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admin access list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Admin access{' '}
          <span className="font-normal text-muted-foreground tabular-nums">({initialRoles.length})</span>
        </h2>

        {/* phones */}
        <div className="space-y-2 md:hidden">
          {initialRoles.length === 0 ? (
            <EmptyCard message="No admin users yet. Add an email and role above." />
          ) : (
            initialRoles.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{r.email}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant={ROLE_VARIANT[r.role]}>{ROLE_LABELS[r.role]}</Badge>
                      {r.broker_id && (
                        <span className="truncate text-xs text-muted-foreground">
                          {brokerName(r.broker_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.role !== 'superuser' && (
                    <Button
                      type="button"
                      onClick={() => handleRemove(r.email)}
                      disabled={loading}
                      variant="ghost"
                      size="sm"
                      className="h-11 shrink-0 px-4 text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
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
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Role</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Broker</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No admin users yet. Add an email and role above.
                  </TableCell>
                </TableRow>
              ) : (
                initialRoles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[r.role]}>{ROLE_LABELS[r.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{brokerName(r.broker_id)}</TableCell>
                    <TableCell className="text-right">
                      {r.role !== 'superuser' && (
                        <Button
                          type="button"
                          onClick={() => handleRemove(r.email)}
                          disabled={loading}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

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

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  )
}
