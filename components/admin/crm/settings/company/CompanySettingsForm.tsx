'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { updateCompanySettingsAction } from '@/app/actions/crm-company-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormRow, SectionDivider } from './form-shared'
import { OfficeHoursEditor } from './OfficeHoursEditor'
import { SpamLabelChange, SubdomainChange } from './ChangeDialogs'
import { WeeklyRecipientsEditor } from './WeeklyRecipientsEditor'

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

/**
 * The exact recorded-call announcements the Twilio voice layer plays. These
 * mirror the <Say> verbs in app/api/twilio/voice/route.ts and
 * outbound-bridge/route.ts (kept literal there so ci:call-recording-consent
 * can grep them). There is no pre-recorded audio file — Twilio speaks these.
 */
const DISCLOSURE_CALL = 'This call may be recorded for quality purposes.'
const DISCLOSURE_VOICEMAIL =
  'You have reached Ryan Realty. This call is recorded. Please leave a message after the tone and we will call you right back.'

/** §1.10 registration badge mapping — live Twilio A2P campaign status. */
function registrationBadge(status: string | null): { label: string; className: string } {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Fully Registered', className: 'bg-success text-success-foreground' }
    case 'IN_PROGRESS':
    case 'PENDING':
      return { label: 'Under Carrier Review', className: 'bg-warning text-warning-foreground' }
    case 'FAILED':
      return { label: 'Rejected by Carriers', className: 'bg-destructive text-destructive-foreground' }
    case 'NONE':
      return { label: 'Not Started', className: 'bg-secondary text-secondary-foreground' }
    default:
      return { label: 'Status unavailable', className: 'bg-secondary text-secondary-foreground' }
  }
}

// ---- Main component -------------------------------------------------------

/**
 * CompanySettingsForm — client form for /admin/crm/settings/company (spec §1).
 *
 * The Save button (§1.9) commits: basic company info, fallback_number,
 * call_recording_enabled, production_goal. Sections with their own flows save
 * immediately through dedicated actions: office hours (§1.5), spam label
 * (§1.4), subdomain (§1.6), weekly report recipients (§1.7). Block list is a
 * dedicated sub-page (§1.8); Business Registration is a sub-page (§1.10)
 * showing the LIVE Twilio A2P campaign status passed in as `a2pStatus`.
 */
export function CompanySettingsForm({
  settings,
  a2pStatus,
  blockedCount,
}: {
  settings: CrmCompanySettings
  a2pStatus: string | null
  blockedCount: number
}) {
  // Controlled state for Select and Switch fields (non-native form controls)
  const [industry, setIndustry] = useState(settings.industry)
  const [franchise, setFranchise] = useState(settings.franchise)
  const [country, setCountry] = useState(settings.country)
  const [timeZone, setTimeZone] = useState(settings.time_zone)
  const [callRecording, setCallRecording] = useState(settings.call_recording_enabled)
  const [spamLabel, setSpamLabel] = useState(settings.spam_label_entity)
  const [subdomain, setSubdomain] = useState(settings.subdomain)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goal, setGoal] = useState(
    settings.production_goal.toLocaleString('en-US', { maximumFractionDigits: 0 }),
  )

  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // production_goal_year is always present (DB default + DAL fallback stamp it
  // server-side) — no client-side clock needed (ci:hydration-safety).
  const year = settings.production_goal_year
  const badge = registrationBadge(a2pStatus)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Override values for non-native controls (Select/Switch aren't native form fields)
    fd.set('industry', industry)
    fd.set('franchise', franchise)
    fd.set('country', country)
    fd.set('time_zone', timeZone)
    fd.set('call_recording_enabled', String(callRecording))
    fd.set('production_goal', goal)

    startTransition(async () => {
      try {
        await updateCompanySettingsAction(fd)
        setSaveStatus('saved')
        setEditingGoal(false)
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
      <Card className="shadow-sm">
        {/* Card header — §1.2: gear + title left, View Business Registration right */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-base text-muted-foreground" aria-hidden>⚙</span>
            <h2 className="text-base font-semibold text-foreground">Company Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={badge.className}>{badge.label}</Badge>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/crm/settings/company/registration">View Business Registration</Link>
            </Button>
          </div>
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
            label="Phone"
            description="Per-broker business lines forward to each broker's cell."
          >
            <div className="flex items-center gap-2 pt-1 text-sm">
              <span aria-hidden className="text-muted-foreground">✎</span>
              <Button asChild type="button" variant="link" className="h-auto p-0 text-sm text-primary">
                <Link href="/admin/crm/settings/team">Manage Settings</Link>
              </Button>
            </div>
          </FormRow>

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
            label="Spam label calling protection"
            description="Legal entity name shown to carriers for STIR/SHAKEN caller ID."
          >
            <div className="flex items-center gap-2 pt-1 text-sm">
              <span className="font-medium text-foreground">{spamLabel}</span>
              <SpamLabelChange value={spamLabel} onSaved={setSpamLabel} />
            </div>
          </FormRow>

          <FormRow label="Call Recording">
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

          <FormRow label="Legal Disclosure">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="legal_disclosure_auto_play"
                  checked
                  disabled
                  aria-label="Automatically play call recording disclosure for all calls"
                />
                <Label htmlFor="legal_disclosure_auto_play" className="text-sm text-muted-foreground">
                  Automatically play call recording disclosure for all calls
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Locked on. Callers can be in two-party consent states, so the
                notice always plays whenever a call records.
              </p>
              {/* Preview call disclosure — the exact announcements Twilio speaks */}
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">Preview call disclosure</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Forwarded and outbound calls: &ldquo;{DISCLOSURE_CALL}&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Voicemail greeting: &ldquo;{DISCLOSURE_VOICEMAIL}&rdquo;
                </p>
              </div>
              {/* Legal Requirements info box */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-foreground">
                  Legal Requirements for call disclosure
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
                  Oregon is a two-party consent state. This disclosure stays enabled.
                </p>
              </div>
            </div>
          </FormRow>

          {/* ---- §1.5 Office Hours ---- */}
          <SectionDivider label="Office Hours" />

          <FormRow
            description="Specify the days and times your team can receive incoming calls to your team inboxes."
          >
            <OfficeHoursEditor blocks={settings.office_hours} />
          </FormRow>

          {/* ---- §1.6 Subdomain ---- */}
          <SectionDivider label="Subdomain" />

          <FormRow description="Change the subdomain of your account.">
            <div className="flex items-center gap-2 pt-1 text-sm">
              <span className="font-medium text-foreground">{subdomain}.ryan-realty.com</span>
              <SubdomainChange value={subdomain} onSaved={setSubdomain} />
            </div>
          </FormRow>

          {/* ---- §1.7 Business Insights ---- */}
          <SectionDivider label="Business Insights" />

          <FormRow label={`Production Goals ${year}`} htmlFor="production_goal">
            {editingGoal ? (
              <div className="flex max-w-56 items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="production_goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="max-w-40"
                  placeholder="1,000,000"
                  autoFocus
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 pt-1 text-sm text-primary"
                onClick={() => setEditingGoal(true)}
              >
                ${goal}
              </Button>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {editingGoal ? 'Commits with Save below.' : 'Click to edit.'}
            </p>
          </FormRow>

          <FormRow
            label="Weekly Report Recipients"
            description="Who receives the Monday weekly pipeline report."
          >
            <WeeklyRecipientsEditor recipients={settings.weekly_report_recipients} />
          </FormRow>

          {/* ---- §1.8 Block List ---- */}
          <SectionDivider label="Block List" />

          <FormRow description="Set which emails and phone numbers you want to block.">
            <div className="pt-1 text-sm">
              <Button asChild type="button" variant="link" className="h-auto p-0 text-sm text-primary">
                <Link href="/admin/crm/settings/company/block-list">Manage block list settings</Link>
              </Button>
              <span className="ml-2 text-xs text-muted-foreground">
                {blockedCount} {blockedCount === 1 ? 'number' : 'numbers'} blocked
              </span>
            </div>
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
      </Card>
    </form>
  )
}
