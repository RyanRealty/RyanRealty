'use client'

// @no-parity — internal admin tool (one OREF fill → email Matt → seal)
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SectionHead, StateWord } from '@/components/admin/v2'
import {
  emailOrefPacketToMatt,
  fillOrefSaleAgreementFromDeal,
  sealOrefPacket,
  type PreferredOrefForm,
} from '@/app/actions/tc-oref-packet'

const tiny = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const

export function FillOrefPacket({
  cycleId,
  form,
}: {
  cycleId: string
  form: PreferredOrefForm | null
}) {
  const [pending, startTransition] = useTransition()
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [filledKeys, setFilledKeys] = useState<string[]>([])
  const [omittedKeys, setOmittedKeys] = useState<string[]>([])
  const [sealed, setSealed] = useState(false)

  if (!form) {
    return (
      <section aria-label="OREF packet" style={{ marginTop: 16 }}>
        <SectionHead>OREF packet</SectionHead>
        <p style={{ ...tiny, margin: 0 }}>No OREF sale agreement is in the form library.</p>
      </section>
    )
  }

  const formLabel = `OREF ${form.formNumber} ${form.name.replace(/\s+\(SAMPLE.*$/i, '')}`

  function fill() {
    startTransition(async () => {
      const { data, error } = await fillOrefSaleAgreementFromDeal(cycleId)
      if (error || !data) {
        toast.error(error ?? 'Could not fill the form.')
        return
      }
      setDocumentId(data.documentId)
      setFilledKeys(data.filledKeys)
      setOmittedKeys(data.omittedFactKeys)
      setSealed(false)
      toast.success(`Filled OREF ${data.formNumber} from deal facts.`)
    })
  }

  function emailMatt() {
    if (!documentId) return
    startTransition(async () => {
      const { error } = await emailOrefPacketToMatt(documentId)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Queued to Matt\'s mailbox.')
    })
  }

  function seal() {
    if (!documentId) return
    startTransition(async () => {
      const { data, error } = await sealOrefPacket(documentId)
      if (error || !data) {
        toast.error(error ?? 'Could not seal the packet.')
        return
      }
      setSealed(true)
      toast.success('Sealed PDF filed on this cycle.')
    })
  }

  return (
    <section aria-label="OREF packet" style={{ marginTop: 16 }}>
      <SectionHead>OREF packet</SectionHead>
      <p style={{ ...tiny, margin: '4px 0 10px' }}>
        {formLabel}. Fill from this cycle’s deal facts, email Matt, then seal. Brokers do not
        build forms. Not a client send.
      </p>
      {form.updateAvailable ? (
        <p style={{ ...tiny, margin: '0 0 10px' }}>
          <StateWord state="waiting">Update available</StateWord> A newer published version is
          at the source. Check /admin/forms before sending this packet to a client.
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button onClick={fill} disabled={pending}>
          {pending && !documentId ? 'Filling…' : 'Fill from deal'}
        </Button>
        <Button variant="quiet" onClick={emailMatt} disabled={pending || !documentId}>
          Email to Matt
        </Button>
        <Button variant="quiet" onClick={seal} disabled={pending || !documentId || sealed}>
          Seal PDF
        </Button>
      </div>
      {documentId ? (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <StateWord state={sealed ? 'ok' : 'accent'}>{sealed ? 'Sealed' : 'Filled'}</StateWord>
          {filledKeys.length ? (
            <span style={{ ...tiny, fontVariantNumeric: 'tabular-nums' }}>
              {filledKeys.length} fact{filledKeys.length === 1 ? '' : 's'} filled
              {omittedKeys.length ? ` · ${omittedKeys.length} omitted` : ''}
            </span>
          ) : (
            <span style={tiny}>No deal facts were present. Nothing was invented.</span>
          )}
        </div>
      ) : null}
    </section>
  )
}
