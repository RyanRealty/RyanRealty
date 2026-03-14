'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminRoleRow, AdminRoleType } from '@/app/actions/admin-roles'
import type { BrokerRow } from '@/app/actions/brokers'
import { upsertAdminRole, removeAdminRole } from '@/app/actions/admin-roles'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Props = {
  initialRoles?: AdminRoleRow[]
  brokers?: BrokerRow[]
}

export default function AdminUsersList({ initialRoles = [], brokers = [] }: Props) {
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
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="min-w-[200px]">
          <Label htmlFor="user-email" className="block text-xs font-medium text-muted-foreground">
            Email (Google account)
          </Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 w-full"
          />
        </div>
        <div>
          <Label htmlFor="user-role" className="block text-xs font-medium text-muted-foreground">
            Role
          </Label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRoleType)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="report_viewer">Report viewer (reports only)</option>
            <option value="broker">Broker (profile + reviews)</option>
            <option value="superuser">Superuser (full access)</option>
          </select>
        </div>
        {role === 'broker' && (
          <div className="min-w-[180px]">
            <Label htmlFor="user-broker" className="block text-xs font-medium text-muted-foreground">
              Broker profile
            </Label>
            <select
              id="user-broker"
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Adding…' : 'Add user'}
        </Button>
      </form>
      {message && (
        <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'}>
          {message.text}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
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
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No users yet. Add an email and role above.
                </TableCell>
              </TableRow>
            ) : (
              initialRoles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-foreground">{r.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.role}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.broker_id ? brokers.find((b) => b.id === r.broker_id)?.display_name ?? '—' : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.role !== 'superuser' && (
                      <Button
                        type="button"
                        onClick={() => handleRemove(r.email)}
                        disabled={loading}
                        variant="ghost"
                        size="sm"
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
    </div>
  )
}
