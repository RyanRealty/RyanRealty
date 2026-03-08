'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminRoleRow, AdminRoleType } from '@/app/actions/admin-roles'
import type { BrokerRow } from '@/app/actions/brokers'
import { upsertAdminRole, removeAdminRole } from '@/app/actions/admin-roles'

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
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="min-w-[200px]">
          <label htmlFor="user-email" className="block text-xs font-medium text-zinc-500">
            Email (Google account)
          </label>
          <input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="user-role" className="block text-xs font-medium text-zinc-500">
            Role
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRoleType)}
            className="mt-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="report_viewer">Report viewer (reports only)</option>
            <option value="broker">Broker (profile + reviews)</option>
            <option value="superuser">Superuser (full access)</option>
          </select>
        </div>
        {role === 'broker' && (
          <div className="min-w-[180px]">
            <label htmlFor="user-broker" className="block text-xs font-medium text-zinc-500">
              Broker profile
            </label>
            <select
              id="user-broker"
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Adding…' : 'Add user'}
        </button>
      </form>
      {message && (
        <p className={message.type === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
          {message.text}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Broker</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {initialRoles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No users yet. Add an email and role above.
                </td>
              </tr>
            ) : (
              initialRoles.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-sm text-zinc-900">{r.email}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{r.role}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {r.broker_id ? brokers.find((b) => b.id === r.broker_id)?.display_name ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.role !== 'superuser' && (
                      <button
                        type="button"
                        onClick={() => handleRemove(r.email)}
                        disabled={loading}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
