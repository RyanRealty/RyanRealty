'use client'

/**
 * Review-page action rail. Primary action is origin-aware Approve & send
 * (or Approve & queue). Client edits, rebuild, custom email, and archive
 * sit under details so the page stays a read-then-send instrument.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, ConfirmDialog, SelectField, TextField } from '@/components/admin/v2'
import { CmaTextMeButton } from '@/components/admin/crm/CmaTextMeButton'
import { cmaCrmComposeHref } from '@/lib/cma/crm-compose-href'
import { formatPriceExact } from '@/lib/format/money'
import {
  rebuildCmaAction,
  rebrandCmaAction,
  approveCmaAction,
  archiveCmaAction,
  unarchiveCmaAction,
  deleteCmaAction,
  searchCmaPersonAction,
  attachCmaPersonAction,
} from '@/app/actions/cma-admin'
import { approveAndDeliverCma } from '@/app/actions/cma-queue'
import { cmaClientIntentLabel, isCmaClientIntent, type CmaClientIntent } from '@/lib/cma/client-intent'
import './cma-review.css'

export interface CmaReviewActionsProps {
  cmaId: string
  slug: string
  status: string
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  personId: number | null
  personName: string | null
  subjectBeds: number | null
  subjectBaths: number | null
  subjectSqft: number | null
  clientIntent: CmaClientIntent | null
  recommendedList: number | null
  priceOverride: number | null
  brokerSlug: string | null
  brokers: Array<{ slug: string; displayName: string }>
  hasDocument: boolean
  sendLabel: string | null
}

const usd = formatPriceExact

export function CmaReviewActions(props: CmaReviewActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [clientName, setClientName] = useState(props.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(props.clientEmail ?? '')
  const [clientPhone, setClientPhone] = useState(props.clientPhone ?? '')
  const [priceOverride, setPriceOverride] = useState(
    props.priceOverride != null ? String(props.priceOverride) : '',
  )
  const [brokerSlug, setBrokerSlug] = useState(props.brokerSlug ?? props.brokers[0]?.slug ?? 'matthew-ryan')
  const [personId, setPersonId] = useState<number | null>(props.personId)
  const [personName, setPersonName] = useState(props.personName ?? '')
  const [personQuery, setPersonQuery] = useState('')
  const [personHits, setPersonHits] = useState<Array<{ id: number; name: string | null; email: string | null }>>([])
  const [beds, setBeds] = useState(props.subjectBeds != null ? String(props.subjectBeds) : '')
  const [baths, setBaths] = useState(props.subjectBaths != null ? String(props.subjectBaths) : '')
  const [sqft, setSqft] = useState(props.subjectSqft != null ? String(props.subjectSqft) : '')
  const [intent, setIntent] = useState<CmaClientIntent | ''>(props.clientIntent ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isDraft = props.status === 'draft'
  const isArchived = props.status === 'archived'
  const composeHref =
    personId && props.hasDocument
      ? cmaCrmComposeHref({ personId, slug: props.slug, channel: 'email' })
      : null

  function rebuild() {
    const override = priceOverride.trim() ? Number(priceOverride.replace(/[^0-9.]/g, '')) : null
    if (priceOverride.trim() && (!Number.isFinite(override) || (override ?? 0) <= 0)) {
      toast.error('Price adjustment must be a positive number.')
      return
    }
    startTransition(async () => {
      const { error } = await rebuildCmaAction({
        slug: props.slug,
        clientName: clientName.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        personId,
        beds: beds.trim() || null,
        baths: baths.trim() || null,
        sqft: sqft.trim() || null,
        intent: intent || null,
        priceOverride: override,
      })
      if (error) toast.error(error)
      else {
        toast.success('Rebuilt. Open Review CMA to read the new document.')
        router.refresh()
      }
    })
  }

  function rebrand() {
    startTransition(async () => {
      const { error } = await rebrandCmaAction({ slug: props.slug, brokerSlug })
      if (error) toast.error(error)
      else {
        toast.success('Re-branded. Same numbers, new signature block.')
        router.refresh()
      }
    })
  }

  function approve() {
    startTransition(async () => {
      const { error } = await approveCmaAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success('Approved.')
        router.refresh()
      }
    })
  }

  function approveAndSend() {
    startTransition(async () => {
      const res = await approveAndDeliverCma(props.slug)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.outcome === 'sent') toast.success('Sent.')
      else if (res.outcome === 'queued') toast.success(`Queued. ${res.position} waiting in the drip.`)
      else toast.success(res.reason)
      router.refresh()
    })
  }

  function remove() {
    setDeleteOpen(false)
    startTransition(async () => {
      const { error } = await deleteCmaAction(props.cmaId)
      if (error) toast.error(error)
      else {
        toast.success('CMA deleted.')
        router.push('/admin/cmas')
      }
    })
  }

  function toggleArchive() {
    startTransition(async () => {
      const { error } = isArchived ? await unarchiveCmaAction(props.slug) : await archiveCmaAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success(isArchived ? 'CMA restored.' : 'CMA archived. It is hidden from send surfaces until restored.')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      {props.sendLabel ? (
        <div className="cma-send-dock">
          <Button onClick={approveAndSend} disabled={isPending || !props.hasDocument} touch className="w-full">
            {isPending ? 'Working…' : props.sendLabel}
          </Button>
        </div>
      ) : isDraft ? (
        <Button onClick={approve} disabled={isPending || !props.hasDocument} variant="quiet" touch className="w-full">
          Approve (draft to final)
        </Button>
      ) : null}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Client, price, rebuild
        </summary>
        <div className="space-y-4" style={{ marginTop: 12 }}>
          <div className="space-y-1.5">
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {personId
                ? `Linked person: ${personName || clientName || `people/${personId}`}`
                : 'No person linked. Search and attach a CRM contact.'}
            </p>
            {personId ? (
              <Link href={`/admin/people/${personId}`} style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-xs)' }}>
                Open person file
              </Link>
            ) : null}
            <TextField
              label="Find person"
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
              hint="Name, at least two characters. This is the person-link, not free-text client name."
            />
            <Button
              type="button"
              variant="quiet"
              disabled={isPending || personQuery.trim().length < 2}
              onClick={() => {
                startTransition(async () => {
                  const { data, error } = await searchCmaPersonAction(personQuery)
                  if (error) toast.error(error)
                  else setPersonHits(data)
                })
              }}
            >
              Search people
            </Button>
            {personHits.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {personHits.map((hit) => (
                  <li key={hit.id} style={{ marginBottom: 6 }}>
                    <Button
                      type="button"
                      variant="quiet"
                      className="w-full"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const { data, error } = await attachCmaPersonAction({
                            slug: props.slug,
                            personId: hit.id,
                          })
                          if (error || !data) {
                            toast.error(error ?? 'Could not link this person.')
                            return
                          }
                          setPersonId(data.personId)
                          setPersonName(data.clientName ?? hit.name ?? '')
                          if (data.clientName) setClientName(data.clientName)
                          if (data.clientEmail) setClientEmail(data.clientEmail)
                          if (data.clientPhone) setClientPhone(data.clientPhone)
                          setPersonHits([])
                          setPersonQuery('')
                          toast.success(`Linked to ${data.clientName ?? hit.name ?? `people/${hit.id}`}.`)
                          router.refresh()
                        })
                      }}
                    >
                      {hit.name ?? `people/${hit.id}`}
                      {hit.email ? ` · ${hit.email}` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <TextField label="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <TextField label="Client email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          <TextField label="Client phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />

          <div className="grid gap-4 md:grid-cols-3">
            <TextField label="Beds" inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value)} />
            <TextField label="Baths" inputMode="decimal" value={baths} onChange={(e) => setBaths(e.target.value)} />
            <TextField label="Sqft" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </div>
          <SelectField
            label="Rent or sell"
            value={intent}
            onChange={(e) => setIntent(isCmaClientIntent(e.target.value) ? e.target.value : '')}
          >
            <option value="">Not set</option>
            <option value="sell">{cmaClientIntentLabel('sell')}</option>
            <option value="rent">{cmaClientIntentLabel('rent')}</option>
            <option value="both">{cmaClientIntentLabel('both')}</option>
          </SelectField>

          <div className="space-y-1.5">
            <SelectField label="Signing broker" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
              {props.brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.displayName}
                </option>
              ))}
            </SelectField>
            <Button
              type="button"
              variant="quiet"
              className="mt-2"
              disabled={isPending || !isDraft || brokerSlug === (props.brokerSlug ?? '')}
              onClick={rebrand}
            >
              Re-brand for this broker
            </Button>
          </div>

          <TextField
            label="Adjust recommended list price"
            placeholder={props.recommendedList != null ? String(props.recommendedList) : 'e.g. 725000'}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
            hint={`Data-supported recommendation: ${usd(props.recommendedList)}. Setting a number here re-anchors the tier grid on your price and notes the adjustment in the document. Leave blank to keep the computed value.`}
          />

          <Button onClick={rebuild} disabled={isPending} variant="quiet" touch className="w-full">
            {isPending ? 'Working…' : 'Save and rebuild'}
          </Button>
        </div>
      </details>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Custom email, text me
        </summary>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          {props.hasDocument ? <CmaTextMeButton slug={props.slug} /> : null}
          {composeHref ? (
            <a href={composeHref} className="av2-btn av2-btn--quiet av2-btn--touch w-full" style={{ textDecoration: 'none' }}>
              Write a custom email
            </a>
          ) : (
            <Button touch className="w-full" disabled variant="quiet">
              Write a custom email
            </Button>
          )}
          {!personId ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-warn, var(--a-text-2))' }}>
              Link a CRM person under Client, price, rebuild to open compose.
            </p>
          ) : null}
        </div>
      </details>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Remove
        </summary>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          <Button onClick={toggleArchive} variant="quiet" touch className="w-full" disabled={isPending}>
            {isArchived ? 'Restore from archive' : 'Archive CMA'}
          </Button>
          <Button onClick={() => setDeleteOpen(true)} variant="danger" touch className="w-full" disabled={isPending}>
            Delete CMA
          </Button>
        </div>
      </details>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this CMA?"
        description="The stored document, pricing, and comp set are removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        busy={isPending}
      />
    </div>
  )
}
