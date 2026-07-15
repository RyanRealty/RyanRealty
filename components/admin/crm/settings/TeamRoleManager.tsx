'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminRoleType } from '@/app/actions/admin-roles'
import { upsertAdminRole, removeAdminRole } from '@/app/actions/admin-roles'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type TeamBrokerOption = { id: string; display_name: string }

/**
 * TeamRoleForm — add or update an admin_roles row (email + role + optional
 * broker link). Ported from the retired role manager on /admin/users
 * (consolidation 2026-07-15) so /admin/crm/settings/team is the single
 * admin_roles surface. Calls the existing upsertAdminRole server action,
 * which carries its own superuser guard.
 */
export function TeamRoleForm({ brokers }: { brokers: TeamBrokerOption[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRoleType>('report_viewer')
  const [brokerId, setBrokerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Add or update access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          They must sign in with this Google account to get in. Re-submitting an existing email
          changes its role.
        </p>
        <form onSubmit={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-user-email" className="text-xs font-medium text-muted-foreground">
              Email (Google account)
            </Label>
            <Input
              id="team-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-11 w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-user-role" className="text-xs font-medium text-muted-foreground">
              Role
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as AdminRoleType)}>
              <SelectTrigger id="team-user-role" className="h-11 w-full">
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
              <Label htmlFor="team-user-broker" className="text-xs font-medium text-muted-foreground">
                Broker profile
              </Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger id="team-user-broker" className="h-11 w-full">
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
  )
}

/**
 * RemoveAdminRoleButton — remove admin access for one email (confirm first).
 * Calls the existing removeAdminRole server action (superuser-guarded; the
 * designated superuser cannot be removed).
 */
export function RemoveAdminRoleButton({ email }: { email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (!confirm(`Remove admin access for ${email}?`)) return
    setError(null)
    setLoading(true)
    const result = await removeAdminRole(email)
    setLoading(false)
    if (result.ok) {
      router.refresh()
      return
    }
    setError(result.error)
  }

  return (
    <>
      <Button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-destructive hover:text-destructive"
      >
        Remove
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </>
  )
}
