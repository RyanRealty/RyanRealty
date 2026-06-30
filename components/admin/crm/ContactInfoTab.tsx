/**
 * ContactInfoTab — the contact Info tab rebuilt to match the Follow Up Boss
 * iOS Info tab: clean iOS "inset grouped" sections (small uppercase header +
 * white rows with a label on the left, value/chevron on the right), not boxed
 * cards with dropdowns and icon clutter.
 *
 * Sections, in FUB order: Phone · Emails · Relationships · Details (Assigned /
 * Stage / Source / Tags) · Inquiries · Custom fields.
 */
import { ChevronRight, Mail, MessageSquare, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AutoSubmitSelect from '@/components/admin/crm/AutoSubmitSelect'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </div>
  )
}

/** A plain label/value row (FUB style). `chevron` adds the trailing ›. */
function Row({ label, value, chevron, muted }: { label: string; value: React.ReactNode; chevron?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`flex min-w-0 items-center gap-1 truncate text-sm font-medium ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        <span className="truncate">{value}</span>
        {chevron ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </span>
    </div>
  )
}

export function ContactInfoTab(props: {
  personId: number
  phones: Array<{ id: number; display: string; tel: string; isPrimary: boolean }>
  emails: Array<{ id: number; value: string; isPrimary: boolean }>
  assignedBroker: string | null
  stage: string
  source: string | null
  tags: string[]
  brokerOptions: Array<{ value: string; label: string }>
  stageOptions: string[]
  assignBrokerAction: (formData: FormData) => Promise<void>
  updateStageAction: (formData: FormData) => Promise<void>
  startCallAction: (formData: FormData) => Promise<void>
  inquiry: { source: string; date: string | null } | null
  relationshipsNode: React.ReactNode
  customFieldsNode: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      {props.phones.length > 0 ? (
        <Section title="Phone">
          {props.phones.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <a href={p.tel} className="min-w-0 truncate text-sm font-medium tabular-nums text-foreground hover:underline">
                {p.display}
                {p.isPrimary ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">primary</span> : null}
              </a>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button asChild size="icon" variant="outline" className="h-8 w-8" aria-label="Text this number">
                  <a href="#comms"><MessageSquare className="h-4 w-4" /></a>
                </Button>
                <form action={props.startCallAction}>
                  <Button type="submit" size="icon" className="h-8 w-8" aria-label="Call this number">
                    <Phone className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      {props.emails.length > 0 ? (
        <Section title="Emails">
          {props.emails.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <a href={`mailto:${e.value}`} className="min-w-0 truncate text-sm font-medium text-foreground hover:underline">
                {e.value}
                {e.isPrimary ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">primary</span> : null}
              </a>
              <Button asChild size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Email this address">
                <a href="#comms"><Mail className="h-4 w-4" /></a>
              </Button>
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="Relationships">
        <div className="px-4 py-3">{props.relationshipsNode}</div>
      </Section>

      <Section title="Details">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground">Assigned to</span>
          <form action={props.assignBrokerAction} className="flex items-center">
            <input type="hidden" name="personId" value={props.personId} />
            <AutoSubmitSelect name="broker" defaultValue={props.assignedBroker ?? undefined} placeholder="Unassigned" aria-label="Assigned broker" options={props.brokerOptions} />
          </form>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground">Stage</span>
          <form action={props.updateStageAction} className="flex items-center">
            <input type="hidden" name="personId" value={props.personId} />
            <AutoSubmitSelect name="stage" defaultValue={props.stage} aria-label="Stage" options={props.stageOptions.map((s) => ({ value: s, label: s }))} />
          </form>
        </div>
        <Row label="Source" value={props.source ?? '—'} muted={!props.source} />
        {props.tags.length > 0 ? (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">Tags</span>
            <span className="text-right text-sm font-medium text-foreground">{props.tags.slice(0, 12).join(', ')}</span>
          </div>
        ) : null}
      </Section>

      {props.inquiry ? (
        <Section title="Inquiries">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">Registration</div>
              <div className="truncate text-xs text-muted-foreground">via {props.inquiry.source}</div>
            </div>
            {props.inquiry.date ? <span className="shrink-0 text-xs text-muted-foreground">{props.inquiry.date}</span> : null}
          </div>
        </Section>
      ) : null}

      {props.customFieldsNode ? (
        <Section title="Custom fields">
          <div className="px-4 py-3">{props.customFieldsNode}</div>
        </Section>
      ) : null}
    </div>
  )
}
