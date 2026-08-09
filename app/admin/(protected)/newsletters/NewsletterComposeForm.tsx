'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SelectField, TextAreaField, TextField } from '@/components/admin/v2'
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
  /**
   * Render only the edit form, no internal preview tab — the review page owns
   * the rendered preview (NewsletterPreviewPanel) and embeds this in its Edit
   * section.
   */
  editOnly?: boolean
}

/**
 * Compose or edit a newsletter draft. shadcn Select can't post a native form
 * value, so this is a controlled client form that calls the server action with
 * a hand-built FormData. On create → redirect to the new draft's detail page.
 *
 * When editing an existing draft (id set), a "Preview" tab renders the draft
 * through the REAL send pipeline for a chosen broker — proving the per-broker
 * identity swap — and a "Send test to me" control sends one copy to the admin.
 *
 * Admin v2 (11F): shadcn Input/Textarea/Select/Label/Tabs/Button replaced by the
 * locked admin language. The tab pair is a real ARIA tablist (role=tab /
 * shipped for the sibling NewsletterPreviewPanel, which keeps Radix Tabs' mount
 * behaviour exactly — the inactive pane unmounts. Label + control pairs collapse
 * into the field primitives, which own the <label htmlFor> wiring themselves, so
 * the visible label and the programmatic association both survive. ci:admin-ui
 * rule C counts primary v2 <Button>s across the whole file, so the draft's Save /
 * Create submit keeps the primary variant and both preview-pane actions are
 * quiet, matching NewsletterPreviewPanel. Presentation only: same server actions,
 * same FormData fields, same routing, same strings.
 */
export default function NewsletterComposeForm({ id, initial, editOnly }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [previewText, setPreviewText] = useState(initial?.preview_text ?? '')
  const [audience, setAudience] = useState(initial?.audience ?? 'all')
  const [body, setBody] = useState(initial?.body_html ?? '')
  const [bodyText, setBodyText] = useState(initial?.body_text ?? '')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  // Replaces <Tabs defaultValue="compose"> — same uncontrolled-from-the-caller
  // default, declared above the early return so hook order never varies.
  const [tab, setTab] = useState<'compose' | 'preview'>('compose')

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
      <TextField
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="What's happening in the Bend market"
        required
      />

      <div className="space-y-1.5">
        <TextField
          label="Preview text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="The one line inbox preview shown next to the subject."
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Optional. The short line inboxes show after the subject.
        </p>
      </div>

      <div className="w-full sm:w-72">
        <SelectField label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="space-y-1.5">
        <TextAreaField
          label="Body (HTML)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Write the newsletter here."
          // style, not className: the field primitives hard-set className to
          // av2-input and spread rest AFTER it, so a className prop would
          // replace the primitive's own styling rather than add to it.
          style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-sm)' }}
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          HTML renders inside the branded newsletter shell.
        </p>
      </div>

      <div className="space-y-1.5">
        <TextAreaField
          label="Body (plain text)"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          placeholder="Plain-text version for clients that can't render HTML."
          style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-sm)' }}
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Optional. Auto-generated from the HTML at send if left blank.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : id ? 'Save draft' : 'Create draft'}
        </Button>
        {message ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 'var(--a-text-sm)',
              color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
            }}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </>
  )

  // New-draft form: no preview yet (nothing saved to render). editOnly: the
  // review page already renders the visual preview, so skip the internal tab.
  if (!id || editOnly) {
    return (
      <form onSubmit={onSubmit} className="space-y-5">
        {fields}
      </form>
    )
  }

  return (
    <div className="space-y-5">
      {/* A real tablist. The migration replaced Radix <Tabs> with a role="group"
          of toggle chips, which drops role=tablist/tab/tabpanel, aria-selected,
          the aria-controls pairing and Left/Right/Home/End roving — a screen
          reader stopped hearing "tab 1 of 2" and the keyboard user had to Tab
          through each chip. v2's TabBar is a <nav> of links for page-level
          navigation, so it is the wrong primitive here; the pattern is wired
          directly instead. */}
      <div
        className="flex"
        role="tablist"
        aria-label="Draft view"
        onKeyDown={(e) => {
          const order = ['compose', 'preview'] as const
          const i = order.indexOf(tab)
          let next: (typeof order)[number] | null = null
          if (e.key === 'ArrowRight') next = order[(i + 1) % order.length]
          else if (e.key === 'ArrowLeft') next = order[(i - 1 + order.length) % order.length]
          else if (e.key === 'Home') next = order[0]
          else if (e.key === 'End') next = order[order.length - 1]
          if (!next) return
          e.preventDefault()
          setTab(next)
          document.getElementById(`newsletter-tab-${next}`)?.focus()
        }}
        style={{
          gap: 2,
          padding: 2,
          background: 'var(--a-inset)',
          borderRadius: 'var(--a-r-md)',
          width: 'fit-content',
        }}
      >
        {(
          [
            { key: 'compose' as const, label: 'Compose' },
            { key: 'preview' as const, label: 'Preview as broker' },
          ]
        ).map((t) => (
          <Button
            key={t.key}
            id={`newsletter-tab-${t.key}`}
            type="button"
            variant="quiet"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`newsletter-panel-${t.key}`}
            // Roving tabindex: only the selected tab is in the tab order, which
            // is what makes Left/Right the way you move between them.
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            style={{
              border: 'none',
              borderRadius: 'var(--a-r-sm)',
              minHeight: 0,
              padding: '6px 14px',
              fontWeight: 500,
              background: tab === t.key ? 'var(--a-bg)' : 'transparent',
              color: tab === t.key ? 'var(--a-text)' : 'var(--a-text-2)',
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'compose' ? (
        <form
          id="newsletter-panel-compose"
          role="tabpanel"
          aria-labelledby="newsletter-tab-compose"
          onSubmit={onSubmit}
          className="space-y-5"
        >
          {fields}
        </form>
      ) : null}

      {tab === 'preview' ? (
        <div id="newsletter-panel-preview" role="tabpanel" aria-labelledby="newsletter-tab-preview">
          <NewsletterPreviewPane id={id} />
        </div>
      ) : null}
    </div>
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
        <div className="w-40">
          <SelectField label="Render as" value={broker} onChange={(e) => onBrokerChange(e.target.value)}>
            {BROKERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="button" variant="quiet" onClick={() => loadPreview(broker)} disabled={pending}>
          {pending ? 'Rendering…' : html ? 'Refresh preview' : 'Load preview'}
        </Button>
        <Button type="button" variant="quiet" onClick={onTestSend} disabled={pending}>
          Send test to me
        </Button>
        {testMsg ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 'var(--a-text-sm)',
              color: testMsg.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
            }}
          >
            {testMsg.text}
          </p>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        Previews the saved draft. Save the Compose tab first to see the latest edits. The close block below the body
        swaps to the selected broker&rsquo;s identity.
      </p>

      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}

      {html ? (
        <iframe
          title="Newsletter preview"
          srcDoc={html}
          // Fully-restricted sandbox: the preview renders the draft's body_html, which
          // is authored content. No sandbox = a <script>/onerror in the HTML would run
          // in the admin's session (stored XSS). An email never needs script, so block
          // all of it — static HTML, CSS, and images still render under sandbox="".
          sandbox=""
          className="w-full"
          style={{
            height: 720,
            borderRadius: 'var(--a-r-lg)',
            border: '1px solid var(--a-border)',
            // --a-surface, not --a-bg: the page behind this pane is --a-bg, and a
            // panel painted its own parent's colour is an invisible panel.
            background: 'var(--a-surface)',
          }}
        />
      ) : !error ? (
        <div
          style={{
            borderRadius: 'var(--a-r-lg)',
            border: '1px dashed var(--a-border)',
            background: 'var(--a-inset)',
            padding: 32,
            textAlign: 'center',
            fontSize: 'var(--a-text-sm)',
            color: 'var(--a-text-2)',
          }}
        >
          Load the preview to see how this newsletter renders for the selected broker.
        </div>
      ) : null}
    </div>
  )
}
