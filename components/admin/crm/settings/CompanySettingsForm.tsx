'use client'

import { useState, useTransition } from 'react'
import type { CrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { updateCompanySettingsAction } from '@/app/actions/crm-company-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ---- Static option lists -------------------------------------------------

const INDUSTRY_OPTIONS = [
  'Real Estate',
  'Mortgage',
  'Title',
  'Property Management',
  'Other',
]

const FRANCHISE_OPTIONS = [
  'Other',
  'Keller Williams',
  'RE/MAX',
  'Coldwell Banker',
  'Century 21',
  'eXp Realty',
  'Berkshire Hathaway HomeServices',
  'Compass',
  "Sotheby's International Realty",
]

const COUNTRY_OPTIONS = ['United States', 'Canada']

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (GMT-07:00)' },
  { value: 'America/Denver',      label: 'Mountain Time (GMT-06:00)' },
  { value: 'America/Chicago',     label: 'Central Time (GMT-05:00)' },
  { value: 'America/New_York',    label: 'Eastern Time (GMT-04:00)' },
  { value: 'America/Anchorage',   label: 'Alaska Time (GMT-08:00)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (GMT-10:00)' },
]

// ---- Sub-components -------------------------------------------------------

/** All-caps section divider with flanking separators (FUB-style). */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

/** Two-column form row: label left (~30%), control(s) right (~70%). */
function FormRow({
  label,
  htmlFor,
  children,
  description,
  className,
}: {
  label?: string
  htmlFor?: string
  children: React.ReactNode
  description?: string
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-[1fr_2fr] items-start gap-x-6 gap-y-1 py-2.5', className)}>
      <div className="pt-1">
        {label && (
          <Label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground leading-snug"
          >
            {label}
          </Label>
        )}
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ---- Main component -------------------------------------------------------

/**
 * CompanySettingsForm — client form for /admin/crm/settings/company.
 *
 * Manages Switch + Select state locally; submits to updateCompanySettingsAction
 * via useTransition. Shows a brief "Saved" confirmation in the button on success.
 *
 * Per spec §1.9, the Save button covers: basic company info, fallback_number,
 * call_recording_enabled, legal_disclosure_auto_play, production_goal.
 * Fields managed via separate flows (office_hours, subdomain, spam_label_entity,
 * weekly_report_recipients, block_list) are shown read-only with navigation cues.
 */
export function CompanySettingsForm({ settings }: { settings: CrmCompanySettings }) {
  // Controlled state for Select and Switch fields (non-native form controls)
  const [industry, setIndustry] = useState(settings.industry)
  const [franchise, setFranchise] = useState(settings.franchise)
  const [country, setCountry] = useState(settings.country)
  const [timeZone, setTimeZone] = useState(settings.time_zone)
  const [callRecording, setCallRecording] = useState(settings.call_recording_enabled)
  const [legalDisclosure, setLegalDisclosure] = useState(settings.legal_disclosure_auto_play)

  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const year = settings.production_goal_year || new Date().getFullYear()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Override values for non-native controls (Select/Switch aren't native form fields)
    fd.set('industry', industry)
    fd.set('franchise', franchise)
    fd.set('country', country)
    fd.set('time_zone', timeZone)
    fd.set('call_recording_enabled', String(callRecording))
    fd.set('legal_disclosure_auto_play', String(legalDisclosure))

    startTransition(async () => {
      try {
        await updateCompanySettingsAction(fd)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } catch (err) {
        setSaveStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Failed to save')
        setTimeout(() => setSaveStatus('idle'), 5000)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Card header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="text-base text-muted-foreground" aria-hidden>⚙</span>
          <h2 className="text-base font-semibold text-foreground">Company settings</h2>
        </div>

        {/* Form body */}
        <div className="px-6 py-2">

          {/* ---- §1.3 Basic company info ---- */}
          <FormRow label="Company" htmlFor="company_name">
            <Input
              id="company_name"
              name="company_name"
              defaultValue={settings.company_name}
              placeholder="Ryan Realty"
              className="max-w-sm"
            />
          </FormRow>

          <FormRow label="Industry" htmlFor="industry-select">
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="industry-select" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Franchise" htmlFor="franchise-select">
            <Select value={franchise} onValueChange={setFranchise}>
              <SelectTrigger id="franchise-select" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRANCHISE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Address" htmlFor="address_line_1">
            <div className="flex max-w-sm flex-col gap-2">
              <Input
                id="address_line_1"
                name="address_line_1"
                defaultValue={settings.address_line_1}
                placeholder="Street address"
              />
              <Input
                name="address_line_2"
                defaultValue={settings.address_line_2}
                placeholder="Suite / unit"
              />
            </div>
          </FormRow>

          <FormRow label="City" htmlFor="city">
            <Input
              id="city"
              name="city"
              defaultValue={settings.city}
              className="max-w-48"
            />
          </FormRow>

          <FormRow label="State" htmlFor="state">
            <Input
              id="state"
              name="state"
              defaultValue={settings.state}
              className="max-w-48"
            />
          </FormRow>

          <FormRow label="Zipcode" htmlFor="zipcode">
            <Input
              id="zipcode"
              name="zipcode"
              defaultValue={settings.zipcode}
              className="max-w-28"
              maxLength={10}
            />
          </FormRow>

          <FormRow label="Country" htmlFor="country-select">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country-select" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Time zone" htmlFor="timezone-select">
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger id="timezone-select" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          {/* ---- §1.4 Virtual Phone ---- */}
          <SectionDivider label="Virtual Phone" />

          <FormRow
            label="Fallback number"
            htmlFor="fallback_number"
            description="Calls route here when no agent is available."
          >
            <Input
              id="fallback_number"
              name="fallback_number"
              defaultValue={settings.fallback_number}
              placeholder="(541) 213-6706"
              className="max-w-52"
            />
          </FormRow>

          <FormRow
            label="Spam label protection"
            description="Legal entity name shown to carriers for STIR/SHAKEN caller ID. Edit via Business Registration."
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{settings.spam_label_entity}</span>
              <span className="text-xs text-muted-foreground">(managed in Business Registration)</span>
            </div>
          </FormRow>

          <FormRow label="Call recording">
            <div className="flex items-center gap-3">
              <Switch
                id="call_recording_enabled"
                checked={callRecording}
                onCheckedChange={setCallRecording}
                aria-label="Enable call recording for team members"
              />
              <Label htmlFor="call_recording_enabled" className="text-sm text-muted-foreground cursor-pointer">
                Enable call recording for team members
              </Label>
            </div>
          </FormRow>

          <FormRow label="Legal disclosure">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="legal_disclosure_auto_play"
                  checked={legalDisclosure}
                  onCheckedChange={setLegalDisclosure}
                  aria-label="Automatically play call recording disclosure for all calls"
                />
                <Label htmlFor="legal_disclosure_auto_play" className="text-sm text-muted-foreground cursor-pointer">
                  Automatically play call recording disclosure for all calls
                </Label>
              </div>
              {/* Legal Requirements info box */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-foreground">
                  Legal requirements for call disclosure
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  In some states and jurisdictions it is legally required to obtain
                  the consent of all parties involved in a conversation before a
                  recording is made. Consent may be obtained by notifying all
                  parties at the beginning of the call that it will be recorded.
                  When this feature is disabled, the notification that the call is
                  being recorded will not be played automatically at the beginning
                  of a call.
                </p>
                <p className="mt-2 text-xs font-medium text-primary">
                  Oregon is a two-party consent state. Enabling this disclosure is
                  strongly advised.
                </p>
              </div>
            </div>
          </FormRow>

          {/* ---- §1.5 Office Hours ---- */}
          <SectionDivider label="Office Hours" />

          <FormRow
            description="Specify the days and times your team can receive incoming calls to your team inboxes."
          >
            {settings.office_hours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No office hours configured.{' '}
                <span className="text-xs text-primary/70">(Office hours management coming soon.)</span>
              </p>
            ) : (
              <ul className="space-y-1">
                {settings.office_hours.map((block, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {block.days.join(', ')} · {block.start_time} to {block.end_time}
                  </li>
                ))}
              </ul>
            )}
          </FormRow>

          {/* ---- §1.6 Subdomain ---- */}
          <SectionDivider label="Subdomain" />

          <FormRow description="The subdomain used for your account URL.">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{settings.subdomain}.followupboss.com</span>
              <span className="text-xs text-muted-foreground">(managed separately)</span>
            </div>
          </FormRow>

          {/* ---- §1.7 Business Insights ---- */}
          <SectionDivider label="Business Insights" />

          <FormRow label={`Production goals ${year}`} htmlFor="production_goal">
            <div className="flex max-w-48 items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                id="production_goal"
                name="production_goal"
                defaultValue={settings.production_goal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                className="max-w-40"
                placeholder="1,000,000"
              />
            </div>
          </FormRow>

          <FormRow
            label="Weekly report recipients"
            description="Who receives the weekly performance digest."
          >
            {settings.weekly_report_recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recipients added.{' '}
                <span className="text-xs text-primary/70">(Recipient management coming soon.)</span>
              </p>
            ) : (
              <ul className="space-y-0.5">
                {settings.weekly_report_recipients.map((email) => (
                  <li key={email} className="text-sm text-foreground">{email}</li>
                ))}
              </ul>
            )}
          </FormRow>

          {/* ---- §1.8 Block List ---- */}
          <SectionDivider label="Block List" />

          <FormRow description="Set which emails and phone numbers you want to block.">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary/70 text-xs">(Block list management coming soon.)</span>
            </p>
          </FormRow>

        </div>

        {/* Form footer: Save button */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {saveStatus === 'error' && (
            <p className="text-xs text-destructive">{errorMsg}</p>
          )}
          {saveStatus === 'saved' && (
            <p className="text-xs text-foreground font-medium">Settings saved.</p>
          )}
          {saveStatus === 'idle' && <span />}

          <Button
            type="submit"
            disabled={isPending}
            className="min-w-20"
          >
            {isPending ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}
