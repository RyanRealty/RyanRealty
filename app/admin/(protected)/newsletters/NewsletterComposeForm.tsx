'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminCreateNewsletterAction,
  adminUpdateNewsletterAction,
} from '@/app/actions/newsletter'

const AUDIENCES: { value: string; label: string }[] = [
  { value: 'all', label: 'All subscribers' },
  { value: 'segment:buyer', label: 'Buyers' },
  { value: 'segment:seller', label: 'Sellers' },
  { value: 'segment:past-client', label: 'Past clients' },
]

type Props = {
  /** When set, the form edits an existing draft; otherwise it creates a new one. */
  id?: string
  initial?: {
    subject: string
    preview_text: string | null
    audience: string
    body_html: string | null
  }
}

/**
 * Compose or edit a newsletter draft. shadcn Select can't post a native form
 * value, so this is a controlled client form that calls the server action with
 * a hand-built FormData. On create → redirect to the new draft's detail page.
 */
export default function NewsletterComposeForm({ id, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [previewText, setPreviewText] = useState(initial?.preview_text ?? '')
  const [audience, setAudience] = useState(initial?.audience ?? 'all')
  const [body, setBody] = useState(initial?.body_html ?? '')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!subject.trim()) {
      setMessage({ type: 'err', text: 'A subject is required.' })
      return
    }
    const fd = new FormData()
    fd.set('subject', subject.trim())
    fd.set('preview_text', previewText.trim())
    fd.set('audience', audience)
    fd.set('body_html', body)
    startTransition(async () => {
      if (id) {
        const r = await adminUpdateNewsletterAction(id, fd)
        if (r.ok) {
          setMessage({ type: 'ok', text: 'Draft saved.' })
          router.refresh()
        } else {
          setMessage({ type: 'err', text: 'Could not save the draft.' })
        }
      } else {
        const r = await adminCreateNewsletterAction(fd)
        if (r.ok && r.id) {
          router.push(`/admin/newsletters/${r.id}`)
        } else {
          setMessage({ type: 'err', text: r.error === 'subject_required' ? 'A subject is required.' : 'Could not create the draft.' })
        }
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nl-subject">Subject</Label>
        <Input
          id="nl-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What's happening in the Bend market"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nl-preview">Preview text</Label>
        <Input
          id="nl-preview"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="The one line inbox preview shown next to the subject."
        />
        <p className="text-xs text-muted-foreground">Optional. The short line inboxes show after the subject.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nl-audience">Audience</Label>
        <Select value={audience} onValueChange={setAudience}>
          <SelectTrigger id="nl-audience" className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCES.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nl-body">Body</Label>
        <Textarea
          id="nl-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Write the newsletter here."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">HTML or plain text. HTML renders in the email; plain text is sent as-is.</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : id ? 'Save draft' : 'Create draft'}
        </Button>
        {message ? (
          <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  )
}
