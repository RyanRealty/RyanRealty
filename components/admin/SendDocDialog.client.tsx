'use client'

/**
 * Compose-and-send dialog for the Expireds + FSBO dashboards: pick email or
 * text, pick a template (pre-merged for this owner + property) or write the
 * message, edit freely, send. The Send click is the approval; a flagged
 * document adds the acknowledgment checkbox.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
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
      setAck(false)
    })
  }

  const switchChannel = (next: 'email' | 'sms') => {
    if (!ctx) return
    setChannel(next)
    setTemplateKey('__default__')
    setBody(next === 'email' ? ctx.defaultEmailBody : '')
    setMsg(null)
  }

  const pickTemplate = (key: string) => {
    if (!ctx) return
    setTemplateKey(key)
    if (key === '__default__') {
      setBody(channel === 'email' ? ctx.defaultEmailBody : '')
      setSubject(ctx.defaultEmailSubject)
      return
    }
    if (key === '__blank__') {
      setBody('')
      return
    }
    const list = channel === 'email' ? ctx.emailTemplates : ctx.smsTemplates
    const tpl = list.find((t) => t.key === key)
    if (tpl) {
      setBody(tpl.body)
      if (channel === 'email' && tpl.subject) setSubject(tpl.subject)
    }
  }

  const send = () =>
    startTransition(async () => {
      if (!ctx) return
      setMsg(channel === 'email' ? 'Sending email...' : 'Sending text...')
      if (channel === 'email') {
        const res = await sendDocEmailAction(kind, id, { subject, body, acknowledgeReview: ack })
        setMsg(res.error ? `Failed: ${res.error}` : `Sent (${res.data?.transport}).`)
        if (!res.error) setTimeout(() => setOpen(false), 1200)
      } else {
        const res = await sendDocSmsAction(kind, id, { body })
        setMsg(res.error ? `Failed: ${res.error}` : 'Text sent.')
        if (!res.error) setTimeout(() => setOpen(false), 1200)
      }
    })

  const templates = ctx ? (channel === 'email' ? ctx.emailTemplates : ctx.smsTemplates) : []
  const channelReady = ctx && (channel === 'email' ? !!ctx.email : !!ctx.phone)
  const smsLen = body.length
  const canSend = !!ctx && !pending && channelReady && body.trim().length > 0 && (!ctx.needsReview || ack)

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={buttonVariant} className="h-8" disabled={disabled} title={disabled ? disabledReason : undefined}>
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
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
              <select
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={templateKey}
                onChange={(e) => pickTemplate(e.target.value)}
              >
                {channel === 'email' ? <option value="__default__">Standard report email</option> : null}
                {channel === 'sms' ? <option value="__default__">Write my own</option> : null}
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
                {channel === 'email' ? <option value="__blank__">Write my own</option> : null}
              </select>
            </div>

            {channel === 'email' ? (
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            ) : null}

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Message{channel === 'sms' ? ` · ${smsLen} characters${smsLen > 320 ? ' (long for a first text)' : ''}` : ''}
              </Label>
              <Textarea rows={channel === 'email' ? 8 : 5} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {channel === 'email'
                  ? 'The report button, PDF attachment, and your signature append automatically.'
                  : `Link to the report: ${ctx.docUrl} (paste it in if you want it in the text — links are tap-tracked).`}
              </p>
            </div>

            {ctx.needsReview ? (
              <label className="flex items-start gap-2 text-xs text-foreground">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
                This document is flagged for review. I reviewed the flags and approve sending it.
              </label>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <a href={`/admin/cmas/${ctx.docSlug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-2">
                Open the document
              </a>
              <Button disabled={!canSend} onClick={send}>
                {pending ? 'Working...' : channel === 'email' ? 'Send email' : 'Send text'}
              </Button>
            </div>
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
