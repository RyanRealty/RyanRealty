'use client'

/**
 * Attach a contact's CMA PDF into the G50 composers.
 * Stages bytes into crm-files, then the broker sends from compose.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SelectField } from '@/components/admin/v2'
import { stageCmaPdfForComposeAction, type CmaComposeStage } from '@/app/actions/cma-compose'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'

export type CmaComposeSeed = {
  channel: 'email' | 'sms'
  slug: string
  stage: CmaComposeStage
}

export function CmaComposeAttach(props: {
  personId: number
  cmas: ContactCma[]
  composeSlug: string | null
  onSeed: (seed: CmaComposeSeed) => void
}) {
  const ready = props.cmas.filter((c) => c.hasDocument && c.status !== 'archived')
  const [slug, setSlug] = useState(props.composeSlug ?? ready[0]?.slug ?? '')
  const [pending, startTransition] = useTransition()
  const autoSlug = useRef<string | null>(null)

  useEffect(() => {
    if (props.composeSlug) setSlug(props.composeSlug)
  }, [props.composeSlug])

  function stage(channel: 'email' | 'sms', overrideSlug?: string) {
    const next = overrideSlug ?? slug
    if (!next) return
    startTransition(async () => {
      const res = await stageCmaPdfForComposeAction({
        personId: props.personId,
        slug: next,
        channel: channel === 'sms' ? 'mms' : 'email',
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      props.onSeed({ channel, slug: next, stage: res.data })
      toast.success(channel === 'sms' ? 'CMA attached to the text.' : 'CMA attached to the email draft.')
    })
  }

  useEffect(() => {
    if (!props.composeSlug || !ready.some((c) => c.slug === props.composeSlug)) return
    if (autoSlug.current === props.composeSlug) return
    autoSlug.current = props.composeSlug
    stage('email', props.composeSlug)
    // Auto-attach once when arriving from the CMA review "Send from CRM" link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.composeSlug])

  if (ready.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {ready.length > 1 ? (
        <div style={{ minWidth: 220 }}>
          <SelectField label="CMA" value={slug} onChange={(e) => setSlug(e.currentTarget.value)}>
            {ready.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.subjectAddress || c.slug}
              </option>
            ))}
          </SelectField>
        </div>
      ) : (
        <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {ready[0]?.subjectAddress || ready[0]?.slug}
        </span>
      )}
      <Button type="button" variant="quiet" onClick={() => stage('email')} disabled={pending || !slug}>
        {pending ? 'Attaching…' : 'Attach PDF'}
      </Button>
      <Button type="button" variant="quiet" onClick={() => stage('sms')} disabled={pending || !slug}>
        Text me
      </Button>
      <Button type="button" variant="quiet" onClick={() => stage('email')} disabled={pending || !slug}>
        Email draft
      </Button>
    </div>
  )
}
