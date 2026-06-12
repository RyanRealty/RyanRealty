'use client'

/**
 * CRM email composer with a live "exactly what sends" preview.
 *
 * The textarea holds the editable source (template HTML or plain text, merge
 * tokens already resolved server-side). The preview pane renders the same
 * composition the send path builds — buildEmailPreviewDoc wraps
 * composeOutboundHtml(body, signature) — inside a sandboxed iframe, so brokers
 * review the rendered email, never raw HTML.
 */
import { useMemo, useState } from 'react'
import { buildEmailPreviewDoc } from '@/lib/crm/email-body'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function EmailComposer(props: {
  initialSubject: string
  initialBody: string
  signatureHtml: string | null
  sendAction: (formData: FormData) => Promise<void>
}) {
  const [subject, setSubject] = useState(props.initialSubject)
  const [body, setBody] = useState(props.initialBody)
  const [tab, setTab] = useState<'preview' | 'edit'>(props.initialBody ? 'preview' : 'edit')

  const previewDoc = useMemo(
    () => buildEmailPreviewDoc(body, props.signatureHtml),
    [body, props.signatureHtml],
  )
  const unresolved = useMemo(() => findUnresolvedMergeTokens(subject + ' ' + body), [subject, body])

  return (
    <form action={props.sendAction} className="space-y-2">
      <Input name="subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={tab === 'preview' ? 'default' : 'ghost'} onClick={() => setTab('preview')}>
          Preview, what sends
        </Button>
        <Button type="button" size="sm" variant={tab === 'edit' ? 'default' : 'ghost'} onClick={() => setTab('edit')}>
          Edit
        </Button>
      </div>
      {/* The textarea stays mounted (hidden) so the form always posts `body`. */}
      <Textarea
        name="body"
        rows={10}
        placeholder="Message. Sends from the signed-in broker's own mailbox."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={tab === 'edit' ? '' : 'hidden'}
      />
      {tab === 'preview' ? (
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewDoc}
          className="h-96 w-full rounded-xl border border-border bg-card"
        />
      ) : null}
      {unresolved.length > 0 ? (
        <p className="text-xs font-medium text-warning">
          Unfilled merge fields, this contact has no value for: {unresolved.join(', ')}. Edit before sending.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">Your signature and the Oregon agency disclosure link are added to every send.</span>
        <Button type="submit" size="sm">Send email</Button>
      </div>
    </form>
  )
}
