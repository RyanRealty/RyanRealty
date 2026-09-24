/**
 * One client's own file, rendered from getClientDeal() and nothing else.
 * The page (app/account/transactions/[dealId]/page.tsx) resolves the signed-in
 * identity, 404s a file that is not theirs, and wraps this in AccountFrame.
 */
import Link from 'next/link'
import Image from 'next/image'
import type { ClientDealDetail, ClientTeamMember } from '@/lib/data/tc/client-transactions'
import type { ClientNextStep } from '@/lib/tc/client-portal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format/date'
import { TransactionProgress } from '@/components/account/transactions/TransactionProgress'
import { SignNowButton } from '@/components/account/transactions/SignNowButton'
import { DownloadDocumentButton } from '@/components/account/transactions/DownloadDocumentButton'

/** clientNextSteps() (lib/tc/client-portal.ts) keys a signature step
 *  `sign:${recipientId}` — the only way back to the recipient row this page
 *  needs for openMySigningLink(). */
function recipientIdFromStepKey(key: string): string | null {
  return key.startsWith('sign:') ? key.slice('sign:'.length) : null
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function TransactionDetailView({ deal }: { deal: ClientDealDetail }) {
  const roleLine = deal.role === 'buyer' ? "You're the buyer" : "You're the seller"

  return (
    <>
      <div className="space-y-8">
        {/* a. Header */}
        <header>
          <p className="text-sm text-muted-foreground">
            <Link href="/account/transactions" className="hover:text-foreground hover:underline">
              ← Your transactions
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{deal.address}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roleLine} · {deal.stageLabel}
          </p>
          {deal.closeDate ? (
            <p className="mt-1 text-sm font-medium text-foreground">Closing {formatDate(deal.closeDate)}</p>
          ) : null}
        </header>

        {/* b. Progress */}
        <section aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
            Where things stand
          </h2>
          <TransactionProgress milestones={deal.milestones} />
        </section>

        {/* c. What's next for you */}
        {deal.nextSteps.length > 0 ? (
          <section aria-labelledby="next-heading">
            <h2 id="next-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
              What&apos;s next for you
            </h2>
            <ul className="space-y-3">
              {deal.nextSteps.map((step) => (
                <li key={step.key}>
                  <NextStepCard step={step} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* d. Key dates */}
        {deal.keyDates.length > 0 ? (
          <section aria-labelledby="dates-heading">
            <h2 id="dates-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
              Key dates
            </h2>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {deal.keyDates.map((d) => (
                <div key={`${d.label}-${d.date}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-foreground">{d.label}</span>
                  <span className="text-sm font-medium tabular-nums text-foreground">{formatDate(d.date)}</span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* e. Documents */}
        <section aria-labelledby="documents-heading">
          <h2 id="documents-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
            Your documents
          </h2>
          {deal.documents.length === 0 ? (
            <Card className="px-4 py-6">
              <p className="text-sm text-muted-foreground">Documents appear here as they&apos;re signed.</p>
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden p-0">
              {deal.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.kind === 'signed' && doc.signedAt ? `Signed ${formatDate(doc.signedAt)}` : 'Shared with you'}
                    </p>
                  </div>
                  <DownloadDocumentButton dealId={deal.dealId} documentId={doc.id} />
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* f. Team */}
        <section aria-labelledby="team-heading">
          <h2 id="team-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
            Your team
          </h2>
          <div className="space-y-3">
            {deal.broker ? <BrokerCard broker={deal.broker} /> : null}
            {deal.team.length > 0 ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
                {deal.team.map((member, i) => (
                  <TeamRow key={`${member.role}-${i}`} member={member} />
                ))}
              </Card>
            ) : null}
          </div>
        </section>

        {/* g. Recent updates */}
        {deal.activity.length > 0 ? (
          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
              Recent updates
            </h2>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {deal.activity.map((a, i) => (
                <div key={`${a.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-foreground">{a.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(a.at)}</span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}
      </div>
    </>
  )
}

function NextStepCard({ step }: { step: ClientNextStep }) {
  const recipientId = step.kind === 'signature' ? recipientIdFromStepKey(step.key) : null
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{step.title}</p>
        {step.detail ? <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p> : null}
        {step.due ? <p className="mt-1 text-sm font-medium text-foreground">Due {formatDate(step.due)}</p> : null}
      </div>
      {recipientId ? <SignNowButton recipientId={recipientId} /> : null}
    </Card>
  )
}

function BrokerCard({ broker }: { broker: NonNullable<ClientDealDetail['broker']> }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      {broker.photoUrl ? (
        <Image
          src={broker.photoUrl}
          alt={broker.name}
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {initials(broker.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{broker.name}</p>
        <p className="text-xs text-muted-foreground">Your broker</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {broker.phone ? (
          <Button asChild variant="outline" className="h-11 px-5">
            <a href={`tel:${broker.phone}`}>Call</a>
          </Button>
        ) : null}
        {broker.email ? (
          <Button asChild className="h-11 px-5">
            <a href={`mailto:${broker.email}`}>Email</a>
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function TeamRow({ member }: { member: ClientTeamMember }) {
  const title = member.name ?? member.roleLabel
  const subtitleParts = [member.name ? member.roleLabel : null, member.company].filter(
    (v): v is string => !!v,
  )
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitleParts.length > 0 ? (
          <p className="text-xs text-muted-foreground">{subtitleParts.join(' · ')}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
        {member.phone ? (
          <a
            href={`tel:${member.phone}`}
            className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
          >
            {member.phone}
          </a>
        ) : null}
        {member.email ? (
          <a
            href={`mailto:${member.email}`}
            className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
          >
            Email
          </a>
        ) : null}
      </div>
    </div>
  )
}
