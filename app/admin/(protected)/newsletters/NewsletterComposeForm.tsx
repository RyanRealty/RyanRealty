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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  adminCreateNewsletterAction,
  adminUpdateNewsletterAction,
  adminPreviewNewsletterAction,
  adminTestSendNewsletterAction,
} from '@/app/actions/newsletter'

const AUDIENCES: { value: string; label: string }[] = [
  { value: 'all', label: 'All subscribers' },
  { value: 'segment:buyer', label: 'Buyers' },
  { value: 'segment:seller', label: 'Sellers' },
  { value: 'segment:past-client', label: 'Past clients' },
]

const BROKERS: { value: string; label: string }[] = [
  { value: 'matt', label: 'Matt' },
  { value: 'rebecca', label: 'Rebecca' },
  { value: 'paul', label: 'Paul' },
]

type Props = {
  /** When set, the form edits an existing draft; otherwise it creates a new one. */
  id?: string
  initial?: {
    subject: string
    preview_text: string | null
    audience: string
    body_html: string | null
    body_text: string | null
  }
}

/**
 * Compose or edit a newsletter draft. shadcn Select can't post a native form
 * value, so this is a controlled client form that calls the server action with
 * a hand-built FormData. On create → redirect to the new draft's detail page.
 *
 * When editing an existing draft (id set), a "Preview" tab renders the draft
 * through the REAL send pipeline for a chosen broker — proving the per-broker
 * identity swap — and a "Send test to me" control sends one copy to the admin.
 */
export default function NewsletterComposeForm({ id, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [previewText, setPreviewText] = useState(initial?.preview_text ?? '')
  const [audience, setAudience] = useState(initial?.audience ?? 'all')
  const [body, setBody] = useState(initial?.body_html ?? '')
  const [bodyText, setBodyText] = useState(initial?.body_text ?? '')
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
    fd.set('body_text', bodyText)
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

  const fields = (
    <>
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
        <Label htmlFor="nl-body">Body (HTML)</Label>
        <Textarea
          id="nl-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Write the newsletter here."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">HTML renders inside the branded newsletter shell.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nl-body-text">Body (plain text)</Label>
        <Textarea
          id="nl-body-text"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          placeholder="Plain-text version for clients that can't render HTML."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Optional. Auto-generated from the HTML at send if left blank.</p>
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
    </>
  )

  // New-draft form: no preview yet (nothing saved to render). Edit form: tabs.
  if (!id) {
    return (
      <form onSubmit={onSubmit} className="space-y-5">
        {fields}
      </form>
    )
  }

  return (
    <Tabs defaultValue="compose" className="space-y-5">
      <TabsList>
        <TabsTrigger value="compose">Compose</TabsTrigger>
        <TabsTrigger value="preview">Preview as broker</TabsTrigger>
      </TabsList>

      <TabsContent value="compose">
        <form onSubmit={onSubmit} className="space-y-5">
          {fields}
        </form>
      </TabsContent>

      <TabsContent value="preview">
        <NewsletterPreviewPane id={id} />
      </TabsContent>
    </Tabs>
  )
}

/**
 * Renders the SAVED draft through the real send pipeline for a chosen broker,
 * inside an iframe. Switching the broker Select re-fetches the HTML so the
 * per-broker close block (headshot, first-person note, reply-to) visibly swaps.
 * Reads the persisted draft, so save the compose tab first to preview edits.
 */
function NewsletterPreviewPane({ id }: { id: string }) {
  const [broker, setBroker] = useState('matt')
  const [html, setHtml] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function loadPreview(slug: string) {
    setError(null)
    startTransition(async () => {
      const r = await adminPreviewNewsletterAction(id, slug)
      if (r.ok && r.html) {
        setHtml(r.html)
      } else {
        setHtml(null)
        const map: Record<string, string> = {
          empty_body: 'Add an HTML body and save the draft before previewing.',
          no_brokers: 'The broker roster could not be read.',
          not_found: 'Draft not found.',
          unauthorized: 'You do not have access to preview.',
        }
        setError(map[r.error ?? ''] ?? r.error ?? 'Could not render the preview.')
      }
    })
  }

  function onBrokerChange(slug: string) {
    setBroker(slug)
    setTestMsg(null)
    loadPreview(slug)
  }

  function onTestSend() {
    setTestMsg(null)
    startTransition(async () => {
      const r = await adminTestSendNewsletterAction(id, broker)
      if (r.ok) {
        setTestMsg({ type: 'ok', text: 'Test sent to your inbox.' })
      } else {
        setTestMsg({ type: 'err', text: r.error ?? 'Could not send the test.' })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nl-preview-broker">Render as</Label>
          <Select value={broker} onValueChange={onBrokerChange}>
            <SelectTrigger id="nl-preview-broker" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BROKERS.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => loadPreview(broker)} disabled={pending}>
          {pending ? 'Rendering…' : html ? 'Refresh preview' : 'Load preview'}
        </Button>
        <Button type="button" onClick={onTestSend} disabled={pending}>
          Send test to me
        </Button>
        {testMsg ? (
          <p className={testMsg.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
            {testMsg.text}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Previews the saved draft. Save the Compose tab first to see the latest edits. The close block below the body
        swaps to the selected broker&rsquo;s identity.
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {html ? (
        <iframe
          title="Newsletter preview"
          srcDoc={html}
          style={{ height: 720 }}
          className="w-full rounded-xl border border-border bg-background"
        />
      ) : !error ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          Load the preview to see how this newsletter renders for the selected broker.
        </div>
      ) : null}
    </div>
  )
}
