'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendAdminEmail } from '@/app/actions/admin-email'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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
    <form onSubmit={handleSend} className={`space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm ${className}`}>
      <div>
        <Label htmlFor="compose-to" className="block text-sm font-medium text-muted-foreground">To</Label>
        <Input
          id="compose-to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div>
        <Label htmlFor="compose-subject" className="block text-sm font-medium text-muted-foreground">Subject</Label>
        <Input
          id="compose-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div>
        <Label htmlFor="compose-body" className="block text-sm font-medium text-muted-foreground">Body</Label>
        <Textarea
          id="compose-body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>
      {message && (
        <p className={message.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-success'}>
          {message.text}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send now'}
      </Button>
    </form>
  )
}
