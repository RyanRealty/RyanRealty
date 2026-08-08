'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { updateCompanySettingsAction } from '@/app/actions/crm-company-settings'
import {
  Button,
  SearchField,
  SectionHead,
  SelectField,
  StateWord,
  Switch,
  TextField,
  type AdminState,
} from '@/components/admin/v2'
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

/**
 * §1.10 registration mapping — live Twilio A2P campaign status.
 *
 * P11F: the badge is a v2 <StateWord>, so the mapping carries a locked admin
 * state instead of a Tailwind class. Status stays text + color, never color
 * alone; the labels are unchanged.
 */
function registrationBadge(status: string | null): { label: string; state: AdminState } {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Fully Registered', state: 'ok' }
    case 'IN_PROGRESS':
    case 'PENDING':
      return { label: 'Under Carrier Review', state: 'slow' }
    case 'FAILED':
      return { label: 'Rejected by Carriers', state: 'down' }
    case 'NONE':
      return { label: 'Not Started', state: 'waiting' }
    default:
      return { label: 'Status unavailable', state: 'waiting' }
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
 *
 * P11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Every labelled control is now a v2 field primitive that owns its own <label>
 * (pattern 6: label above, single column), so the fields no longer carry a
 * hand-assigned `id` — the primitive mints one with useId() and wires htmlFor
 * to it. The submitted `name` attributes, the FormData overrides below, and
 * updateCompanySettingsAction are untouched.
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
      <div className="av2-pane">
        {/* Pane header — §1.2: gear + title left, View Business Registration right */}
        <div
          className="flex flex-wrap items-center justify-between"
          style={{
            gap: 'var(--a-s3)',
            borderBottom: '1px solid var(--a-border)',
            paddingBottom: 'var(--a-s3)',
          }}
        >
          <div className="flex items-center" style={{ gap: 'var(--a-s3)' }}>
            <span style={{ color: 'var(--a-text-2)' }} aria-hidden>⚙</span>
            <SectionHead>Company Settings</SectionHead>
          </div>
          <div className="flex items-center" style={{ gap: 'var(--a-s2)' }}>
            <StateWord state={badge.state}>{badge.label}</StateWord>
            <Link
              href="/admin/crm/settings/company/registration"
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              View Business Registration
            </Link>
          </div>
        </div>

        {/* Form body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s4)' }}>

          {/* ---- §1.3 Basic company info ---- */}
          <TextField
            label="Company"
            name="company_name"
            defaultValue={settings.company_name}
            placeholder="Ryan Realty"
          />

          <SelectField label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </SelectField>

          <SelectField label="Franchise" value={franchise} onChange={(e) => setFranchise(e.target.value)}>
            {FRANCHISE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </SelectField>

          <TextField
            label="Address"
            name="address_line_1"
            defaultValue={settings.address_line_1}
            placeholder="Street address"
          />

          <TextField
            label="Suite / unit"
            name="address_line_2"
            defaultValue={settings.address_line_2}
            placeholder="Suite / unit"
          />

          <TextField label="City" name="city" defaultValue={settings.city} />

          <TextField label="State" name="state" defaultValue={settings.state} />

          <TextField label="Zipcode" name="zipcode" defaultValue={settings.zipcode} maxLength={10} />

          <SelectField label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </SelectField>

          <SelectField label="Time zone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {TIMEZONE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>

          {/* ---- §1.4 Virtual Phone ---- */}
          <SectionDivider label="Virtual Phone" />

          <FormRow
            label="Phone"
            description="Per-broker business lines forward to each broker's cell."
          >
            <div
              className="flex items-center"
              style={{ gap: 'var(--a-s2)', fontSize: 'var(--a-text-sm)' }}
            >
              <span aria-hidden style={{ color: 'var(--a-text-2)' }}>✎</span>
              <Link
                href="/admin/crm/settings/team"
                style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
              >
                Manage Settings
              </Link>
            </div>
          </FormRow>

          <TextField
            label="Fallback number"
            hint="Calls route here when no agent is available."
            name="fallback_number"
            defaultValue={settings.fallback_number}
            placeholder="(541) 213-6706"
          />

          <FormRow
            label="Spam label calling protection"
            description="Legal entity name shown to carriers for STIR/SHAKEN caller ID."
          >
            <div
              className="flex flex-wrap items-center"
              style={{ gap: 'var(--a-s2)', fontSize: 'var(--a-text-sm)' }}
            >
              <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{spamLabel}</span>
              <SpamLabelChange value={spamLabel} onSaved={setSpamLabel} />
            </div>
          </FormRow>

          <FormRow label="Call Recording">
            <Switch
              label="Enable call recording for team members"
              checked={callRecording}
              onChange={(e) => setCallRecording(e.target.checked)}
            />
          </FormRow>

          <FormRow label="Legal Disclosure">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s3)' }}>
              <Switch
                label="Automatically play call recording disclosure for all calls"
                checked
                disabled
              />
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Locked on. Callers can be in two-party consent states, so the
                notice always plays whenever a call records.
              </p>
              {/* Preview call disclosure — the exact announcements Twilio speaks */}
              <div className="av2-pane" style={{ gap: 'var(--a-s1)', padding: 'var(--a-s3)' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--a-text-xs)',
                    fontWeight: 600,
                    color: 'var(--a-text)',
                  }}
                >
                  Preview call disclosure
                </p>
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Forwarded and outbound calls: &ldquo;{DISCLOSURE_CALL}&rdquo;
                </p>
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Voicemail greeting: &ldquo;{DISCLOSURE_VOICEMAIL}&rdquo;
                </p>
              </div>
              {/* Legal Requirements info box */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--a-s2)',
                  border: '1px solid var(--a-border)',
                  borderRadius: 'var(--a-r-lg)',
                  background: 'var(--a-accent-wash)',
                  padding: 'var(--a-s4)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--a-text-xs)',
                    fontWeight: 600,
                    color: 'var(--a-text)',
                  }}
                >
                  Legal Requirements for call disclosure
                </p>
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  In some states and jurisdictions it is legally required to obtain
                  the consent of all parties involved in a conversation before a
                  recording is made. Consent may be obtained by notifying all
                  parties at the beginning of the call that it will be recorded.
                  When this feature is disabled, the notification that the call is
                  being recorded will not be played automatically at the beginning
                  of a call.
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--a-text-xs)',
                    fontWeight: 500,
                    color: 'var(--a-accent)',
                  }}
                >
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
            <div
              className="flex flex-wrap items-center"
              style={{ gap: 'var(--a-s2)', fontSize: 'var(--a-text-sm)' }}
            >
              <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                {subdomain}.ryan-realty.com
              </span>
              <SubdomainChange value={subdomain} onSaved={setSubdomain} />
            </div>
          </FormRow>

          {/* ---- §1.7 Business Insights ---- */}
          <SectionDivider label="Business Insights" />

          <FormRow label={`Production Goals ${year}`}>
            {editingGoal ? (
              <div className="flex items-center" style={{ gap: 'var(--a-s1)' }}>
                <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>$</span>
                <SearchField
                  type="text"
                  aria-label={`Production Goals ${year}`}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="1,000,000"
                  style={{ maxWidth: 160 }}
                  autoFocus
                />
              </div>
            ) : (
              <Button variant="quiet" className="a-num" onClick={() => setEditingGoal(true)}>
                ${goal}
              </Button>
            )}
            <p
              style={{
                margin: 'var(--a-s1) 0 0',
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
              }}
            >
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
            <div style={{ fontSize: 'var(--a-text-sm)' }}>
              <Link
                href="/admin/crm/settings/company/block-list"
                style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
              >
                Manage block list settings
              </Link>
              <span
                className="a-num"
                style={{
                  marginLeft: 'var(--a-s2)',
                  fontSize: 'var(--a-text-xs)',
                  color: 'var(--a-text-2)',
                }}
              >
                {blockedCount} {blockedCount === 1 ? 'number' : 'numbers'} blocked
              </span>
            </div>
          </FormRow>

        </div>

        {/* Form footer: Save button */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s3)' }}
        >
          {saveStatus === 'error' && (
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
              {errorMsg}
            </p>
          )}
          {saveStatus === 'saved' && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--a-text-xs)',
                fontWeight: 500,
                color: 'var(--a-text)',
              }}
            >
              Settings saved.
            </p>
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
