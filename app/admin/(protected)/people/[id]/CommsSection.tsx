'use client'

/**
 * CommsSection (P11B B2) — the v2 person page's daily-use send surface. It
 * mounts the CANONICAL composers AS-IS (SmsComposer / EmailComposer are the
 * G50 compliance chokepoints — ci:composer-discipline; never rebuild the
 * textareas) inside the v2 layout: one compact channel toggle, one template
 * dropdown per channel (server-resolved via ?tpl / ?smsTpl → renderCrmMerge),
 * quiet-hours + suppression words inline. Suggested-reply deep links
 * (?reply&replyChannel&replySubject) preload client-side inside the composers
 * via consumeSuggestedReply — both composers stay mounted (hidden, not
 * unmounted) so either channel's preload lands regardless of the toggle.
 */
import { useState, type ComponentProps } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FilterChip, SelectField } from '@/components/admin/v2'
import { CmaComposeAttach, type CmaComposeSeed } from '@/components/admin/crm/CmaComposeAttach'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer, type SmsRecipient } from '@/components/admin/crm/SmsComposer'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'

type TemplateOpt = { key: string; name: string }

export function CommsSection(props: {
  personId: number
  initialChannel: 'sms' | 'email'
  canSms: boolean
  smsNote: string | null
  canEmail: boolean
  emailNote: string | null
  quietHours: boolean
  smsTemplates: TemplateOpt[]
  emailTemplates: TemplateOpt[]
  tplKey: string | null
  smsTplKey: string | null
  emailInitialSubject: string
  emailInitialBody: string
  smsInitialBody: string
  signatureHtml: string | null
  toLabel: string | null
  initialTo: string[]
  recipientOptions: ComponentProps<typeof EmailComposer>['recipientOptions']
  customFields: ComponentProps<typeof EmailComposer>['customFields']
  smsRecipients: SmsRecipient[]
  sendSms: (formData: FormData) => Promise<void>
  sendEmail: (formData: FormData) => Promise<void>
  saveEmailDraft?: (formData: FormData) => Promise<void>
  saveSmsDraft?: (formData: FormData) => Promise<void>
  cmas?: ContactCma[]
  composeCma?: string | null
}) {
  const [channel, setChannel] = useState<'sms' | 'email'>(props.initialChannel)
  const [cmaSeed, setCmaSeed] = useState<CmaComposeSeed | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function pickTemplate(param: 'tpl' | 'smsTpl', key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key) params.set(param, key)
    else params.delete(param)
    router.push(`${pathname}?${params.toString()}#comms`, { scroll: false })
  }

  const templateSelect = (
    param: 'tpl' | 'smsTpl',
    current: string | null,
    options: TemplateOpt[],
  ) => (
    <div style={{ maxWidth: 320 }}>
      <SelectField
        label="Template"
        value={current ?? ''}
        onChange={(e) => pickTemplate(param, e.currentTarget.value)}
      >
        <option value="">Blank</option>
        {options.map((t) => (
          <option key={t.key} value={t.key}>
            {t.name}
          </option>
        ))}
      </SelectField>
    </div>
  )

  function applyCmaSeed(seed: CmaComposeSeed) {
    setCmaSeed(seed)
    setChannel(seed.channel)
  }

  const emailKey = cmaSeed?.channel === 'email' ? `cma-${cmaSeed.slug}` : (props.tplKey ?? 'blank')
  const smsKey = cmaSeed?.channel === 'sms' ? `cma-${cmaSeed.slug}` : (props.smsTplKey ?? 'blank')
  const emailTo =
    cmaSeed?.channel === 'email' && cmaSeed.stage.householdEmails.length > 0
      ? cmaSeed.stage.householdEmails
      : props.initialTo
  const emailSubject =
    cmaSeed?.channel === 'email' ? cmaSeed.stage.subject : props.emailInitialSubject
  const emailBody = cmaSeed?.channel === 'email' ? cmaSeed.stage.emailBody : props.emailInitialBody
  const smsBody = cmaSeed?.channel === 'sms' ? cmaSeed.stage.smsBody : props.smsInitialBody

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {props.cmas && props.cmas.length > 0 ? (
        <CmaComposeAttach
          personId={props.personId}
          cmas={props.cmas}
          composeSlug={props.composeCma ?? null}
          onSeed={applyCmaSeed}
        />
      ) : null}
      <div className="av2-wordrow" role="group" aria-label="Channel">
        <FilterChip pressed={channel === 'sms'} onClick={() => setChannel('sms')}>
          Text
        </FilterChip>
        <FilterChip pressed={channel === 'email'} onClick={() => setChannel('email')}>
          Email
        </FilterChip>
        {channel === 'sms' ? (
          <span
            style={{ marginLeft: 'auto', fontSize: 'var(--a-text-sm)' }}
            className={props.quietHours ? 'av2-composer__warn' : 'av2-composer__ok'}
          >
            {props.quietHours ? 'Quiet hours — 1:1 manual send allowed' : 'Inside send window'}
          </span>
        ) : null}
      </div>

      <div style={{ display: channel === 'sms' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        {props.canSms ? (
          <>
            {templateSelect('smsTpl', props.smsTplKey, props.smsTemplates)}
            <SmsComposer
              key={smsKey}
              initialBody={smsBody}
              sendAction={props.sendSms}
              saveDraftAction={props.saveSmsDraft}
              recipients={props.smsRecipients}
              primaryPersonId={props.personId}
              personId={props.personId}
              customFields={props.customFields}
              initialAttachments={cmaSeed?.channel === 'sms' ? [cmaSeed.stage.attachment] : undefined}
              textMePhone={cmaSeed?.stage.textMePhone ?? null}
              initialTextMe={cmaSeed?.channel === 'sms'}
            />
          </>
        ) : (
          <div style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{props.smsNote}</div>
        )}
      </div>

      <div style={{ display: channel === 'email' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        {props.canEmail ? (
          <>
            {templateSelect('tpl', props.tplKey, props.emailTemplates)}
            <EmailComposer
              key={emailKey}
              initialSubject={emailSubject}
              initialBody={emailBody}
              signatureHtml={props.signatureHtml}
              sendAction={props.sendEmail}
              saveDraftAction={props.saveEmailDraft}
              personId={props.personId}
              tplKey={props.tplKey}
              toLabel={props.toLabel}
              initialTo={emailTo}
              recipientOptions={props.recipientOptions}
              customFields={props.customFields}
              initialAttachments={cmaSeed?.channel === 'email' ? [cmaSeed.stage.attachment] : undefined}
            />
          </>
        ) : (
          <div style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{props.emailNote}</div>
        )}
      </div>
    </div>
  )
}
