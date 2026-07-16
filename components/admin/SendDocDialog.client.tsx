'use client'

/**
 * Compose-and-send dialog for the Expireds + FSBO dashboards: pick email or
 * text, pick a template (pre-merged for this owner + property) or write the
 * message, edit freely, send. The Send click is the approval; a flagged
 * document adds the acknowledgment checkbox.
 *
 * The editing surfaces are the canonical EmailComposer / SmsComposer (Matt
 * directive 2026-07-15: every text/email send uses the same interface). This
 * dialog only owns the doc context: channel tabs, template seeding, the
 * review-ack gate, and adapting FormData to the send-doc actions. Merge
 * fields / attachments / quiet-hours are hidden — this path pre-merges its
 * own tokens, attaches the report itself, and has no override wiring.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import {
  prepareDocSendAction,
  sendDocEmailAction,
  sendDocSmsAction,
  type DocKind,
  type DocSendContext,
} from '@/app/actions/send-doc'

export function SendDocDialog(props: {
  kind: DocKind
  id: string
  buttonLabel: string
  buttonVariant?: 'default' | 'outline'
  disabled?: boolean
  disabledReason?: string
}) {
  const { kind, id, buttonLabel, buttonVariant = 'default', disabled, disabledReason } = props
  const [open, setOpen] = useState(false)
  const [ctx, setCtx] = useState<DocSendContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [templateKey, setTemplateKey] = useState<string>('__default__')
  // Seed values for the composers — updated only by open/template/channel
  // changes; seedV re-keys the composer so the new seed takes effect.
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [seedV, setSeedV] = useState(0)
  const [ack, setAck] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onOpen = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setMsg(null)
    setLoadError(null)
    setCtx(null)
    startTransition(async () => {
      const res = await prepareDocSendAction(kind, id)
      if (res.error || !res.data) {
        setLoadError(res.error ?? 'Could not prepare the send.')
        return
      }
      setCtx(res.data)
      const startChannel = res.data.email ? 'email' : 'sms'
      setChannel(startChannel)
      setTemplateKey('__default__')
      setSubject(res.data.defaultEmailSubject)
      setBody(startChannel === 'email' ? res.data.defaultEmailBody : '')
      setSeedV((v) => v + 1)
      setAck(false)
    })
  }

  const switchChannel = (next: 'email' | 'sms') => {
    if (!ctx) return
    setChannel(next)
    setTemplateKey('__default__')
    setBody(next === 'email' ? ctx.defaultEmailBody : '')
    setSeedV((v) => v + 1)
    setMsg(null)
  }

  const pickTemplate = (key: string) => {
    if (!ctx) return
    setTemplateKey(key)
    if (key === '__default__') {
      setBody(channel === 'email' ? ctx.defaultEmailBody : '')
      setSubject(ctx.defaultEmailSubject)
      setSeedV((v) => v + 1)
      return
    }
    if (key === '__blank__') {
      setBody('')
      setSeedV((v) => v + 1)
      return
    }
    const list = channel === 'email' ? ctx.emailTemplates : ctx.smsTemplates
    const tpl = list.find((t) => t.key === key)
    if (tpl) {
      setBody(tpl.body)
      if (channel === 'email' && tpl.subject) setSubject(tpl.subject)
      setSeedV((v) => v + 1)
    }
  }

  /** EmailComposer posts here — adapt FormData to the send-doc action. */
  const sendEmailFromComposer = (fd: FormData) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        setMsg('Sending email...')
        const res = await sendDocEmailAction(kind, id, {
          subject: String(fd.get('subject') ?? '').trim(),
          body: String(fd.get('body') ?? ''),
          acknowledgeReview: ack,
        })
        setMsg(res.error ? `Failed: ${res.error}` : `Sent (${res.data?.transport}).`)
        if (!res.error) setTimeout(() => setOpen(false), 1200)
        resolve()
      })
    })

  /** SmsComposer posts here — adapt FormData to the send-doc action. */
  const sendSmsFromComposer = (fd: FormData) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        setMsg('Sending text...')
        const res = await sendDocSmsAction(kind, id, { body: String(fd.get('body') ?? '') })
        setMsg(res.error ? `Failed: ${res.error}` : 'Text sent.')
        if (!res.error) setTimeout(() => setOpen(false), 1200)
        resolve()
      })
    })

  const templates = ctx ? (channel === 'email' ? ctx.emailTemplates : ctx.smsTemplates) : []
  const channelReady = ctx && (channel === 'email' ? !!ctx.email : !!ctx.phone)
  const sendBlocked = !ctx || pending || !channelReady || (ctx.needsReview && !ack)

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={buttonVariant} className="h-8" disabled={disabled} title={disabled ? disabledReason : undefined}>
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Send to {ctx?.ownerName ?? 'owner'} · {ctx?.subjectAddress ?? ''}
          </DialogTitle>
        </DialogHeader>

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
        {!ctx && !loadError ? <p className="text-sm text-muted-foreground">Preparing...</p> : null}

        {ctx ? (
          <div className="space-y-3">
            <Tabs value={channel} onValueChange={(v) => switchChannel(v as 'email' | 'sms')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" disabled={!ctx.email}>
                  Email{ctx.email ? '' : ' (no address)'}
                </TabsTrigger>
                <TabsTrigger value="sms" disabled={!ctx.phone}>
                  Text{ctx.phone ? '' : ' (no phone)'}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Template</Label>
              <Select value={templateKey} onValueChange={pickTemplate}>
                <SelectTrigger className="h-9 w-full" aria-label="Template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channel === 'email' ? <SelectItem value="__default__">Standard report email</SelectItem> : null}
                  {channel === 'sms' ? <SelectItem value="__default__">Write my own</SelectItem> : null}
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                  {channel === 'email' ? <SelectItem value="__blank__">Write my own</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>

            {ctx.needsReview ? (
              <Label className="items-start text-xs font-normal leading-normal text-foreground">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
                This document is flagged for review. I reviewed the flags and approve sending it.
              </Label>
            ) : null}

            {channel === 'email' ? (
              <EmailComposer
                key={`email-${seedV}`}
                initialSubject={subject}
                initialBody={body}
                signatureHtml={null}
                sendAction={sendEmailFromComposer}
                hideRecipients
                hideAttachments
                hideMergeFields
                sendDisabled={sendBlocked}
                footnote="The report button, PDF attachment, and your signature append automatically."
              />
            ) : (
              <div className="space-y-1.5">
                <SmsComposer
                  key={`sms-${seedV}`}
                  initialBody={body}
                  sendAction={sendSmsFromComposer}
                  hideAttachments
                  hideMergeFields
                  hideQuietHours
                  sendDisabled={sendBlocked}
                />
                <p className="text-xs leading-snug text-muted-foreground">
                  Link to the report: {ctx.docUrl} (paste it in if you want it in the text — links are tap-tracked).
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <a href={`/admin/cmas/${ctx.docSlug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-2">
                Open the document
              </a>
              {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
