'use client'

/**
 * TeamAccess (11C, v2 language migration) — the add/update-access form and the
 * remove-access button for /admin/crm/settings/team, rebuilt on the v2
 * primitives. Behavior is a straight port of the legacy
 * components/admin/crm/settings/TeamRoleManager.tsx: same upsertAdminRole /
 * removeAdminRole server actions (each carries its own superuser guard), same
 * fields (email, role, optional broker link), same confirm-before-remove, same
 * router.refresh() on success. Only the presentation changed.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminRoleType } from '@/app/actions/admin-roles'
import { upsertAdminRole, removeAdminRole } from '@/app/actions/admin-roles'
import { Button, SectionHead, SelectField, TextField } from '@/components/admin/v2'

export type TeamBrokerOption = { id: string; display_name: string }

export function TeamAccessForm({ brokers }: { brokers: TeamBrokerOption[] }) {
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
    <section aria-label="Add or update access">
      <SectionHead>Add or update access</SectionHead>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <TextField
          label="Email (Google account)"
          hint="They must sign in with this Google account to get in. Re-submitting an existing email changes its role."
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
        />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as AdminRoleType)}>
          <option value="report_viewer">Report viewer (reports only)</option>
          <option value="broker">Broker (profile + reviews)</option>
          <option value="superuser">Superuser (full access)</option>
        </SelectField>
        {role === 'broker' ? (
          <SelectField label="Broker profile" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
            <option value="">Select a broker</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Adding…' : 'Add user'}
          </Button>
        </div>
      </form>
      {message ? (
        <p
          style={{
            marginTop: 8,
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
          }}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  )
}

export function RemoveAccessButton({ email }: { email: string }) {
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
      <Button type="button" variant="danger" onClick={handleRemove} disabled={loading}>
        Remove
      </Button>
      {error ? <p style={{ marginTop: 4, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p> : null}
    </>
  )
}
