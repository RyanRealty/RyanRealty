'use client'

/**
 * Person-page v3 composer shell. Owns the Text/Email toggle, Templates,
 * Fields, and Attach bar. The G50 composers stay the send chokepoints —
 * this file never renders its own textarea.
 */
import { useState, type ComponentProps } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button, FilterChip, Menu } from '@/components/admin/v2'
import { CmaComposeAttach, type CmaComposeSeed } from '@/components/admin/crm/CmaComposeAttach'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { MergeFieldInserter } from '@/components/admin/crm/MergeFieldInserter'
import { SmsComposer, type SmsRecipient } from '@/components/admin/crm/SmsComposer'
import { useSmsQuiet } from '@/components/admin/crm/use-sms-quiet'
import { ContactSendCenter } from '@/components/admin/crm/ContactSendCenter'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import { Dialog } from '@/components/admin/v2'
import { AttachMenu } from './AttachMenu'
import { type AttachMenuItemId, type LeadComposerChannel, leadComposerSubmitLabel } from './attach-menu'

type TemplateOpt = { key: string; name: string }

export function LeadComposer(props: {
  personId: number
  initialChannel: LeadComposerChannel
  canSms: boolean
  smsNote: string | null
  canEmail: boolean
  emailNote: string | null
  quietHours: boolean
  primaryTimeZones?: string[]
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
  bpos?: ContactBpo[]
  composeCma?: string | null
  personalLink?: string | null
  toLine?: string | null
  inboundClearsImportDnt?: boolean
  emailSuppressed?: boolean
  defaultCity?: string | null
  reportAreas?: Array<{ slug: string; label: string }>
  subscribedAreas?: string[]
  newsletterSubscribed?: boolean
  latestNewsletter?: { subject: string; status: 'sent' | 'scheduled'; sentAt: string | null } | null
  cmaBuildHref?: string
  bpoGenerateAction?: () => Promise<void>
  newsletterSendAction?: (idempotencyKey: string) => Promise<{ ok: boolean; error?: string; message?: string }>
}) {
  const [channel, setChannel] = useState<LeadComposerChannel>(props.initialChannel)
  const leadQuiet = useSmsQuiet(props.primaryTimeZones ?? [], props.quietHours)
  const [composerQuiet, setComposerQuiet] = useState<boolean | null>(null)
  const quietNow = composerQuiet ?? leadQuiet
  const [cmaSeed, setCmaSeed] = useState<CmaComposeSeed | null>(null)
  const [cmaOpen, setCmaOpen] = useState(false)
  const [launchTab, setLaunchTab] = useState<string | null>(null)
  const [insert, setInsert] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function pickTemplate(param: 'tpl' | 'smsTpl', key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key) params.set(param, key)
    else params.delete(param)
    params.set('v', '3')
    router.push(`${pathname}?${params.toString()}#comms`, { scroll: false })
  }

  function applyCmaSeed(seed: CmaComposeSeed) {
    setCmaSeed(seed)
    setChannel(seed.channel)
    setCmaOpen(false)
  }

  function onAttach(id: AttachMenuItemId) {
    if (id === 'file') {
      const el = document.getElementById(channel === 'sms' ? 'lead-attach-sms' : 'lead-attach-email') as HTMLInputElement | null
      el?.click()
      return
    }
    if (id === 'cma') {
      setCmaOpen(true)
      return
    }
    if (id === 'link') {
      if (props.personalLink) setInsert(props.personalLink)
      return
    }
    const tab = id === 'listings' ? 'alerts' : id === 'newsletter' ? 'newsletter' : id === 'report' ? 'report' : 'bpo'
    setLaunchTab(tab)
  }

  const emailKey = cmaSeed?.channel === 'email' ? `cma-${cmaSeed.slug}` : (props.tplKey ?? 'blank')
  const smsKey = cmaSeed?.channel === 'sms' ? `cma-${cmaSeed.slug}` : (props.smsTplKey ?? 'blank')
  const emailTo =
    cmaSeed?.channel === 'email' && cmaSeed.stage.householdEmails.length > 0
      ? cmaSeed.stage.householdEmails
      : props.initialTo
  const emailSubject = cmaSeed?.channel === 'email' ? cmaSeed.stage.subject : props.emailInitialSubject
  const emailBody = cmaSeed?.channel === 'email' ? cmaSeed.stage.emailBody : props.emailInitialBody
  const smsBody = cmaSeed?.channel === 'sms' ? cmaSeed.stage.smsBody : props.smsInitialBody

  const status =
    channel === 'sms'
      ? quietNow
        ? 'Quiet hours — 1:1 manual send allowed'
        : props.inboundClearsImportDnt
          ? 'Inside send window · replies allowed (they texted you)'
          : 'Inside send window'
      : 'Email · tracked links and CAN-SPAM footer stay on the send path'

  const templateItems =
    channel === 'sms'
      ? [
          { label: 'Blank', onSelect: () => pickTemplate('smsTpl', '') },
          ...props.smsTemplates.map((t) => ({ label: t.name, onSelect: () => pickTemplate('smsTpl', t.key) })),
        ]
      : [
          { label: 'Blank', onSelect: () => pickTemplate('tpl', '') },
          ...props.emailTemplates.map((t) => ({ label: t.name, onSelect: () => pickTemplate('tpl', t.key) })),
        ]

  return (
    <div id="comms" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 18px', borderTop: '2px solid var(--a-text)' }}>
      <div className="av2-wordrow" role="group" aria-label="Channel">
        <FilterChip pressed={channel === 'sms'} onClick={() => setChannel('sms')}>
          Text
        </FilterChip>
        <FilterChip pressed={channel === 'email'} onClick={() => setChannel('email')}>
          Email
        </FilterChip>
        {props.toLine ? (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{props.toLine}</span>
        ) : null}
        <span
          style={{ marginLeft: 'auto', fontSize: 'var(--a-text-sm)' }}
          className={channel === 'sms' && quietNow ? 'av2-composer__warn' : 'av2-composer__ok'}
        >
          {status}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <AttachMenu onPick={onAttach} />
        <Menu label="Templates" items={templateItems} trigger={<span>Templates</span>} />
        <MergeFieldInserter
          channel={channel === 'sms' ? 'sms' : 'email'}
          customFields={props.customFields}
          onInsert={(token) => setInsert(token)}
        />
      </div>

      <div style={{ display: channel === 'sms' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        {props.canSms ? (
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
            hideMergeFields
            hideAttachmentTrigger
            attachmentInputId="lead-attach-sms"
            externalInsert={insert}
            quietHours={props.quietHours}
            primaryTimeZones={props.primaryTimeZones}
            onQuietChange={setComposerQuiet}
          />
        ) : (
          <div style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{props.smsNote}</div>
        )}
      </div>

      <div style={{ display: channel === 'email' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        {props.canEmail ? (
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
            hideMergeFields
            hideAiDrafts
            hideAttachmentTrigger
            compactChrome
            attachmentInputId="lead-attach-email"
            externalInsert={insert}
            submitLabel={leadComposerSubmitLabel('email')}
          />
        ) : (
          <div style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{props.emailNote}</div>
        )}
      </div>

      <Dialog open={cmaOpen} onClose={() => setCmaOpen(false)} title="CMA" description="Build one, or attach a finished PDF to this message.">
        {props.cmas && props.cmas.length > 0 ? (
          <CmaComposeAttach
            personId={props.personId}
            cmas={props.cmas}
            composeSlug={props.composeCma ?? null}
            onSeed={applyCmaSeed}
          />
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No CMA PDF yet.</p>
        )}
        <div style={{ marginTop: 12 }}>
          <a href={props.cmaBuildHref ?? '?intent=cma&v=3'} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Build a CMA
          </a>
        </div>
      </Dialog>

      {props.bpoGenerateAction && props.newsletterSendAction ? (
        <ContactSendCenter
          hideTrigger
          launchTab={launchTab}
          onLaunchConsumed={() => setLaunchTab(null)}
          personId={props.personId}
          emailSuppressed={Boolean(props.emailSuppressed)}
          bpos={props.bpos ?? []}
          cmas={props.cmas ?? []}
          reportAreas={props.reportAreas ?? []}
          subscribedAreas={props.subscribedAreas ?? []}
          defaultCity={props.defaultCity ?? null}
          cmaBuildHref={props.cmaBuildHref ?? '?intent=cma&v=3'}
          bpoGenerateAction={props.bpoGenerateAction}
          newsletterSubscribed={Boolean(props.newsletterSubscribed)}
          latestNewsletter={props.latestNewsletter ?? null}
          newsletterSendAction={props.newsletterSendAction}
        />
      ) : null}
    </div>
  )
}
