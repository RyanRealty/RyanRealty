'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendAdminEmail } from '@/app/actions/admin-email'

type Props = { className?: string }

export default function AdminEmailCompose({ className = '' }: Props) {
  const router = useRouter()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!to.trim()) {
      setMessage({ type: 'error', text: 'Enter recipient email' })
      return
    }
    if (!subject.trim()) {
      setMessage({ type: 'error', text: 'Enter subject' })
      return
    }
    setLoading(true)
    const result = await sendAdminEmail({ to: to.trim(), subject: subject.trim(), body: body.trim() })
    setLoading(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'success', text: 'Email sent.' })
    router.refresh()
  }

  return (
    <form onSubmit={handleSend} className={`space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>
      <div>
        <label htmlFor="compose-to" className="block text-sm font-medium text-zinc-700">To</label>
        <input
          id="compose-to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>
      <div>
        <label htmlFor="compose-subject" className="block text-sm font-medium text-zinc-700">Subject</label>
        <input
          id="compose-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>
      <div>
        <label htmlFor="compose-body" className="block text-sm font-medium text-zinc-700">Body</label>
        <textarea
          id="compose-body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>
      {message && (
        <p className={message.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send now'}
      </button>
    </form>
  )
}
