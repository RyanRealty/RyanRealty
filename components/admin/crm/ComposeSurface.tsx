'use client'

/**
 * One compose surface. Text or Email. To chips. Plus adds people.
 * Two people is a group thread. Paperclip attachments. One Send.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Paperclip, Plus, X } from 'lucide-react'
import {
  Button,
  FilterChip,
  IconButton,
  SearchField,
  TextAreaField,
  TextField,
} from '@/components/admin/v2'
import {
  AttachmentChips,
  useComposerAttachments,
} from '@/components/admin/crm/ComposerAttachments'
import { MMS_ACCEPT_ATTR } from '@/lib/crm/attachment-limits'
import { TextDraftTools } from '@/components/admin/crm/TextDraftTools'
import {
  composeRecipientPayload,
  emailsForCompose,
  type ComposePersonChip,
} from '@/lib/crm/compose-group'
import {
  attachLibraryItemAction,
  saveComposeDraftAction,
  searchComposePeopleAction,
  sendComposeAction,
} from '@/app/admin/(protected)/messages/actions'

const EMAIL_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/gif,image/webp,text/vcard,text/x-vcard,.vcf,.doc,.docx,.xls,.xlsx'

export function ComposeSurface({
  initialPeople,
  initialChannel = 'text',
  quiet,
  draftText = '',
  draftEmail = '',
  draftSubject = '',
  cmaSlug = '',
  brokerSelf = false,
}: {
  initialPeople: ComposePersonChip[]
  initialChannel?: 'text' | 'email'
  quiet: boolean
  draftText?: string
  draftEmail?: string
  draftSubject?: string
  cmaSlug?: string
  brokerSelf?: boolean
}) {
  const [channel, setChannel] = useState<'text' | 'email'>(initialChannel)
  const [people, setPeople] = useState<ComposePersonChip[]>(initialPeople)
  const [ccPeople, setCcPeople] = useState<ComposePersonChip[]>([])
  const [showCc, setShowCc] = useState(false)
  const [adding, setAdding] = useState(initialPeople.length === 0)
  const [addTarget, setAddTarget] = useState<'to' | 'cc'>('to')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ComposePersonChip[]>([])
  const [body, setBody] = useState(initialChannel === 'email' ? draftEmail : draftText)
  const [subject, setSubject] = useState(draftSubject)
  const [pending, startTransition] = useTransition()
  const [overrideQuiet, setOverrideQuiet] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const primaryId = people[0]?.id
  const attachments = useComposerAttachments({
    personId: primaryId,
    channel: channel === 'email' ? 'email' : 'mms',
  })

  useEffect(() => {
    setBody(channel === 'email' ? draftEmail : draftText)
  }, [channel, draftEmail, draftText])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      const found = await searchComposePeopleAction(term)
      const taken = new Set([...people, ...ccPeople].map((p) => p.id))
      setHits(found.filter((h) => !taken.has(h.id)))
    }, 200)
  }, [q, people, ccPeople])

  function addPerson(p: ComposePersonChip) {
    if (addTarget === 'cc') setCcPeople((cur) => (cur.some((c) => c.id === p.id) ? cur : [...cur, p]))
    else setPeople((cur) => (cur.some((c) => c.id === p.id) ? cur : [...cur, p]))
    setQ('')
    setHits([])
    setAdding(false)
  }

  function removeTo(id: number) {
    setPeople((cur) => cur.filter((p) => p.id !== id))
  }

  function removeCc(id: number) {
    setCcPeople((cur) => cur.filter((p) => p.id !== id))
  }

  const packed = composeRecipientPayload(people)
  const group = packed.isGroup
  const toEmails = emailsForCompose(people)
  const ccEmails = emailsForCompose(ccPeople)
  const textReady = brokerSelf
    ? Boolean(body.trim() && (!quiet || overrideQuiet))
    : Boolean(packed.personId && body.trim() && people.every((p) => p.phone) && (!quiet || overrideQuiet))
  const emailReady = Boolean(packed.personId && subject.trim() && body.trim() && toEmails.length)
  const canSend = channel === 'email' ? emailReady : textReady

  function send() {
    if (!canSend) return
    if (!brokerSelf && !packed.personId) return
    const fd = new FormData()
    fd.set('channel', channel)
    fd.set('body', body.trim())
    fd.set('idempotencyKey', idempotencyKey)
    if (brokerSelf) {
      fd.set('brokerSelf', '1')
      if (cmaSlug) fd.set('cmaSlug', cmaSlug)
    } else {
      fd.set('personId', String(packed.personId))
    }
    if (quiet && channel === 'text' && overrideQuiet) fd.set('overrideQuietHours', '1')
    if (attachments.ready.length) fd.set('attachments', JSON.stringify(attachments.ready))
    if (channel === 'text') {
      if (packed.extraIds) fd.set('recipientIds', packed.extraIds)
      if (group) fd.set('groupThread', '1')
    } else {
      fd.set('subject', subject.trim())
      fd.set('to', JSON.stringify(toEmails))
      fd.set('cc', JSON.stringify(ccEmails))
      fd.set('bodyFormat', 'text')
    }
    startTransition(async () => {
      const res = await sendComposeAction(fd)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(channel === 'email' ? 'Email sent.' : group ? 'Group text sent.' : 'Text sent.')
        setBody('')
        if (channel === 'email') setSubject('')
      }
    })
  }

  function attachLibrary(kind: 'disclosure' | 'cma' | 'vcard') {
    if (!packed.personId) {
      toast.error('Add someone first.')
      return
    }
    startTransition(async () => {
      const res = await attachLibraryItemAction({
        personId: packed.personId!,
        channel: channel === 'email' ? 'email' : 'mms',
        kind,
        cmaSlug: cmaSlug || undefined,
      })
      if (!res.ok) toast.error(res.error)
      else attachments.addRef(res.ref)
    })
  }

  function saveDraft() {
    if (brokerSelf || !packed.personId) {
      toast.error('Add someone first.')
      return
    }
    const fd = new FormData()
    fd.set('body', body)
    if (channel === 'email') fd.set('subject', subject)
    startTransition(async () => {
      const res = await saveComposeDraftAction(packed.personId!, channel, fd)
      if (!res.ok) toast.error(res.error)
      else toast.success('Draft saved.')
    })
  }

  return (
    <div className="av2-scope" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="group" aria-label="Channel" style={{ display: 'flex', gap: 8 }}>
        <FilterChip pressed={channel === 'text'} onClick={() => setChannel('text')}>
          Text
        </FilterChip>
        <FilterChip pressed={channel === 'email'} onClick={() => setChannel('email')}>
          Email
        </FilterChip>
      </div>

      <RecipientRow
        label="To"
        people={people}
        lock={brokerSelf}
        onRemove={removeTo}
        onAdd={() => {
          setAddTarget('to')
          setAdding(true)
        }}
      />
      {channel === 'email' ? (
        showCc ? (
          <RecipientRow
            label="Cc"
            people={ccPeople}
            onRemove={removeCc}
            onAdd={() => {
              setAddTarget('cc')
              setAdding(true)
            }}
          />
        ) : (
          <Button type="button" variant="quiet" onClick={() => setShowCc(true)}>
            Cc
          </Button>
        )
      ) : null}

      {adding ? (
        <div>
          <SearchField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a person"
            aria-label="Add a person"
            autoFocus
          />
          {hits.length > 0 ? (
            <ul className="av2-queue" style={{ marginTop: 8 }}>
              {hits.map((h) => (
                <li key={h.id}>
                  <Button type="button" variant="quiet" className="w-full" onClick={() => addPerson(h)}>
                    <span style={{ display: 'block', textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{h.name}</span>
                      <span style={{ display: 'block', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                        {[h.phone, h.email].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {group && channel === 'text' ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          One group thread with everyone on it.
        </p>
      ) : null}

      {channel === 'email' ? (
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      ) : null}

      {channel === 'text' && primaryId && people.length === 1 && !brokerSelf ? (
        // Drafting tools ported from the retired inbox compose sheet
        // (Messages-fold final slice): AI pills + per-contact template render.
        // Single-recipient only — a template renders THIS contact's tokens.
        <TextDraftTools personId={primaryId} onDraft={setBody} />
      ) : null}

      <TextAreaField
        label={channel === 'email' ? 'Message' : 'Text'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={channel === 'email' ? 8 : 3}
        required
        placeholder={channel === 'email' ? 'Write the email' : 'Text message'}
        disabled={pending}
      />

      {attachments.items.length > 0 ? <AttachmentChips items={attachments.items} onRemove={attachments.remove} /> : null}

      {primaryId && !brokerSelf ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button type="button" variant="quiet" onClick={() => attachLibrary('disclosure')} disabled={pending}>
            Agency disclosure
          </Button>
          {cmaSlug ? (
            <Button type="button" variant="quiet" onClick={() => attachLibrary('cma')} disabled={pending}>
              CMA PDF
            </Button>
          ) : null}
          {channel === 'email' ? (
            <Button type="button" variant="quiet" onClick={() => attachLibrary('vcard')} disabled={pending}>
              vCard
            </Button>
          ) : null}
        </div>
      ) : null}

      {quiet && channel === 'text' ? (
        <FilterChip pressed={overrideQuiet} onClick={() => setOverrideQuiet((v) => !v)}>
          Send anyway. Quiet hours.
        </FilterChip>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
        {primaryId && !brokerSelf ? (
          <AttachmentPicker attachments={attachments} accept={channel === 'email' ? EMAIL_ACCEPT : MMS_ACCEPT_ATTR} />
        ) : null}
        <Button type="button" variant="quiet" onClick={saveDraft} disabled={pending || !packed.personId}>
          Save draft
        </Button>
        <span style={{ flex: 1 }} />
        <Button type="button" touch onClick={send} disabled={pending || !canSend}>
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        {channel === 'text'
          ? quiet
            ? 'Quiet hours. This tap is a manual send from the business line. STOP still applies.'
            : 'Sends from the business line. STOP and quiet hours still apply to leads.'
          : 'Sends one email to everyone on To. Nothing goes out until you hit Send.'}
      </p>
    </div>
  )
}

function RecipientRow({
  label,
  people,
  onRemove,
  onAdd,
  lock = false,
}: {
  label: string
  people: ComposePersonChip[]
  onRemove: (id: number) => void
  onAdd: () => void
  lock?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', minWidth: 28 }}>{label}</span>
      {people.map((p) => (
        <span
          key={p.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 8px 6px 12px',
            borderRadius: 999,
            background: 'var(--a-inset)',
            fontSize: 'var(--a-text-sm)',
            minHeight: 44,
          }}
        >
          {p.name}
          {lock ? null : (
            <IconButton label={`Remove ${p.name}`} onClick={() => onRemove(p.id)} style={{ width: 32, height: 32 }}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          )}
        </span>
      ))}
      {lock ? null : (
        <IconButton label={`Add ${label === 'Cc' ? 'Cc' : 'person'}`} onClick={onAdd} style={{ width: 44, height: 44 }}>
          <Plus className="h-4 w-4" aria-hidden />
        </IconButton>
      )}
    </div>
  )
}

function AttachmentPicker({
  attachments,
  accept,
}: {
  attachments: ReturnType<typeof useComposerAttachments>
  accept: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className="hidden">
        <TextField
          ref={fileInputRef}
          label="Attachment files"
          type="file"
          multiple
          accept={accept}
          onChange={(e) => {
            if (e.target.files?.length) void attachments.addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <IconButton label="Attach files" onClick={() => fileInputRef.current?.click()} style={{ width: 44, height: 44 }}>
        <Paperclip className="h-4 w-4" aria-hidden />
      </IconButton>
    </>
  )
}
