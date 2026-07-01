/**
 * MobileInfoTab — §25.5 Info tab for the mobile Contact Detail
 *
 * Sections in order (AC-INFO-1):
 *   1. RECENT MESSAGES (conditional)
 *   2. PHONE NUMBERS
 *   3. EMAILS
 *   4. RELATIONSHIPS
 *   5. DETAILS (Assigned to / Stage / Source / Tags / Time frame / Collaborators)
 *   6. FINANCING
 *   7. BACKGROUND
 *   8. INQUIRIES
 *   9. CUSTOM FIELDS
 *  10. ADDRESS
 *
 * Server component — no 'use client' needed; action buttons delegate to the
 * existing server-action forms in the page.
 *
 * Token mapping follows §25.1:
 *   content area bg-secondary, card bg-card, section headers bg-secondary with
 *   muted uppercase labels, accent-colored action circles per §25.5.4/25.5.5.
 */

import { ChevronRight, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactRelationship } from '@/lib/data/crm/getContactRelationships'
import type { ContactCollaborator } from '@/lib/data/crm/getContactCollaborators'
import {
  MobileContactPointsSection,
  type MobilePhoneEntry,
  type MobileEmailEntry,
} from '@/components/admin/crm/mobile/MobileContactPointsSection'
import { MobileDetailsSection } from '@/components/admin/crm/mobile/MobileDetailsSection'
import type { PickerOption } from '@/components/admin/crm/mobile/MobilePickerSheet'

/* ── Types ───────────────────────────────────────────────────────────────────── */

export type { MobilePhoneEntry, MobileEmailEntry }

export interface MobileInquiry {
  type: string
  source: string | null
  address: string | null
  date: string
}

export interface MobileCustomField {
  key: string
  label: string
  value: string
}

export interface MobileAddress {
  type: string
  street: string
  city: string
  state: string
  zip: string
}

export interface MobileRecentMessage {
  id: number
  participants: string
  preview: string
  date: string
}

export interface MobileInfoTabProps {
  personId: number

  recentMessages: MobileRecentMessage[]
  phones: MobilePhoneEntry[]
  emails: MobileEmailEntry[]
  relationships: ContactRelationship[]
  collaborators: ContactCollaborator[]

  /** §25.5.7 DETAILS rows */
  assignedTo: string | null
  assignedToSlug: string | null
  stage: string
  source: string | null
  tags: string[]
  timeframe: string | null
  brokerOptions: PickerOption[]
  stageOptions: string[]

  /** Server actions (page-bound, scope-gated) */
  assignBrokerAction: (fd: FormData) => Promise<void>
  updateStageAction: (fd: FormData) => Promise<void>
  addTagAction: (fd: FormData) => Promise<void>
  removeTagAction: (fd: FormData) => Promise<void>
  addCollaboratorAction: (fd: FormData) => Promise<void>
  removeCollaboratorAction: (fd: FormData) => Promise<void>
  addContactPointAction: (fd: FormData) => Promise<void>

  /** §25.5.8 FINANCING */
  lender: string | null

  /** §25.5.9 BACKGROUND */
  background: string | null

  /** §25.5.10 INQUIRIES */
  inquiries: MobileInquiry[]

  /** §25.5.11 CUSTOM FIELDS */
  customFields: MobileCustomField[]

  /** §25.5.12 ADDRESS */
  addresses: MobileAddress[]
}

/* ── Section header (§25.5.2) ───────────────────────────────────────────────── */

function SectionHeader({
  label,
  rightLabel,
}: {
  label: string
  rightLabel?: string
}) {
  return (
    <div className="flex items-center justify-between bg-secondary px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
        {label}
      </span>
      {rightLabel ? (
        <span className="text-[13px]" style={{ color: 'var(--console-info)' }}>{rightLabel}</span>
      ) : null}
    </div>
  )
}

/* ── Card wrapper (white, shadow-sm) ───────────────────────────────────────── */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card shadow-sm', className)}>
      {children}
    </div>
  )
}

/* ── Detail row (label left, value right) ───────────────────────────────────── */

function DetailRow({
  label,
  value,
  isAction,
  href,
}: {
  label: string
  value: React.ReactNode
  isAction?: boolean
  href?: string
}) {
  const inner = (
    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex min-w-0 items-center gap-1 text-right text-[13px]',
          isAction ? 'font-medium' : 'font-medium text-foreground',
        )}
        style={isAction ? { color: 'var(--console-info)' } : undefined}
      >
        <span className="truncate">{value}</span>
        {href ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : null}
      </span>
    </div>
  )
  if (href) {
    return <a href={href}>{inner}</a>
  }
  return <>{inner}</>
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export function MobileInfoTab({
  personId,
  recentMessages,
  phones,
  emails,
  relationships,
  collaborators,
  assignedTo,
  assignedToSlug,
  stage,
  source,
  tags,
  timeframe,
  brokerOptions,
  stageOptions,
  assignBrokerAction,
  updateStageAction,
  addTagAction,
  removeTagAction,
  addCollaboratorAction,
  removeCollaboratorAction,
  addContactPointAction,
  lender,
  background,
  inquiries,
  customFields,
  addresses,
}: MobileInfoTabProps) {
  return (
    <div className="flex flex-col gap-0 bg-secondary pb-24">

      {/* ── §25.5.3 RECENT MESSAGES (conditional) ──────────────────────────── */}
      {recentMessages.length > 0 && (
        <>
          <SectionHeader label="Recent Messages" />
          <Card>
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">
                  {msg.participants.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground">
                    {msg.participants}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{msg.preview}</p>
                </div>
                <span className="shrink-0 text-[12px] text-muted-foreground">{msg.date}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ── §25.5.4/25.5.5 PHONE NUMBERS + EMAILS — interactive (add + live
             SMS/Call/Email actions) ─────────────────────────────────────────── */}
      <MobileContactPointsSection
        personId={personId}
        phones={phones}
        emails={emails}
        addContactPointAction={addContactPointAction}
      />

      {/* ── §25.5.6 RELATIONSHIPS ──────────────────────────────────────────── */}
      <>
        <SectionHeader
          label="Relationships"
          rightLabel={relationships.length > 0 ? '+' : undefined}
        />
        <Card>
          {relationships.length === 0 ? (
            <div className="px-4 py-3 text-[14px] italic text-muted-foreground">
              Add Relationship...
            </div>
          ) : (
            relationships.map((r) => (
              <div
                key={r.id}
                className="flex min-h-[48px] items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0"
              >
                <div>
                  <p className="text-[14px] font-medium text-foreground">{r.name}</p>
                  <p className="text-[12px] text-muted-foreground">({r.label})</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            ))
          )}
        </Card>
      </>

      {/* ── §25.5.7 DETAILS — interactive rows (pickers per §23.8 / mob-35) ── */}
      <>
        <SectionHeader label="Details" />
        <MobileDetailsSection
          personId={personId}
          assignedTo={assignedTo}
          assignedToSlug={assignedToSlug}
          stage={stage}
          source={source}
          tags={tags}
          timeframe={timeframe}
          collaborators={collaborators.map((c) => ({ slug: c.brokerSlug, name: c.displayName }))}
          brokerOptions={brokerOptions}
          stageOptions={stageOptions}
          assignBrokerAction={assignBrokerAction}
          updateStageAction={updateStageAction}
          addTagAction={addTagAction}
          removeTagAction={removeTagAction}
          addCollaboratorAction={addCollaboratorAction}
          removeCollaboratorAction={removeCollaboratorAction}
        />
      </>

      {/* ── §25.5.8 FINANCING ─────────────────────────────────────────────── */}
      <>
        <SectionHeader label="Financing" />
        <Card>
          <DetailRow label="Lender" value={lender || ''} />
          {/* §25.5.8: "TRANSFER TO LENDER ›" appears when no lender (AC-INFO-6) */}
          {!lender && (
            <div className="flex items-center gap-1 px-4 py-3" style={{ color: 'var(--console-info)' }}>
              <span className="text-[14px] font-semibold uppercase tracking-wide">
                Transfer to Lender
              </span>
              <ChevronRight size={14} />
            </div>
          )}
        </Card>
      </>

      {/* ── §25.5.9 BACKGROUND ─────────────────────────────────────────────── */}
      <>
        <SectionHeader label="Background" />
        <Card>
          {background ? (
            <p className="px-4 py-3 text-[14px] leading-5 text-foreground line-clamp-4">
              {background}
            </p>
          ) : (
            <div className="px-4 py-3 text-[14px] text-muted-foreground">Add background</div>
          )}
        </Card>
      </>

      {/* ── §25.5.10 INQUIRIES ─────────────────────────────────────────────── */}
      {inquiries.length > 0 && (
        <>
          <SectionHeader label="Inquiries" />
          <Card>
            {inquiries.map((inq, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                style={{ minHeight: 56 }}
              >
                {/* §25.5.10: speech-bubble icon, color text-success */}
                <div className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center text-success">
                  <MessageSquare size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-foreground">{inq.type}</p>
                  <p className="text-[13px] text-muted-foreground">
                    via: {inq.source ?? 'unspecified'}
                  </p>
                  {inq.address ? (
                    <p className="text-[13px] text-muted-foreground">{inq.address}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[12px] text-muted-foreground">{inq.date}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ── §25.5.11 CUSTOM FIELDS ─────────────────────────────────────────── */}
      <>
        <SectionHeader
          label="Custom Fields"
          rightLabel={customFields.length > 0 ? 'EDIT ALL...' : undefined}
        />
        <Card>
          {customFields.length === 0 ? (
            <div className="px-4 py-3 text-[14px]" style={{ color: 'var(--console-info)' }}>Add Custom Fields...</div>
          ) : (
            customFields.map((f) => (
              <div
                key={f.key}
                className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </span>
                <span className="truncate text-right text-[13px] font-medium text-foreground">
                  {f.value}
                </span>
              </div>
            ))
          )}
        </Card>
      </>

      {/* ── §25.5.12 ADDRESS ──────────────────────────────────────────────── */}
      {addresses.length > 0 && (
        <>
          <SectionHeader label="Address" />
          <Card>
            {addresses.map((addr, idx) => (
              <div
                key={idx}
                className="flex min-h-[56px] items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <div>
                  <p className="text-[12px] uppercase text-muted-foreground">{addr.type}</p>
                  {/* §25.5.12: address text is accent-colored link */}
                  <p className="text-[14px]" style={{ color: 'var(--console-info)' }}>{addr.street}</p>
                  <p className="text-[14px]" style={{ color: 'var(--console-info)' }}>
                    {[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
                  </p>
                </div>
                {/* §25.5.12: diamond/compass nav icon */}
                <span className="mt-1 shrink-0 text-[16px]" style={{ color: 'var(--console-info)' }}>◇</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
