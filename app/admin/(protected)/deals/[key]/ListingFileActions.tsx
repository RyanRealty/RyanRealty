'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, Dialog, ToolbarRadio } from '@/components/admin/v2'
import { acceptListingContract, duplicateListing, mergeListingInto } from '@/app/actions/tc-listings'
import type { LiveDealCycle } from '@/lib/data/tc/closings'

export function ListingFileActions({
  propertyKey,
  stage,
  others,
}: {
  propertyKey: string
  stage: string
  others: LiveDealCycle[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [mergeOpen, setMergeOpen] = useState(false)
  const [otherKey, setOtherKey] = useState(others[0]?.propertyKey ?? '')
  const listingish = stage === 'active_listing' || stage === 'dead'
  if (!listingish && stage !== 'pending') return null

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
      {stage === 'active_listing' ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Accept a contract on this listing? It becomes a pending sale on the same file. The listing folder stays.'))
              return
            start(async () => {
              const res = await acceptListingContract(propertyKey)
              if (res.error) toast.error(res.error)
              else toast.success('Contract accepted. This file is now pending.')
            })
          }}
        >
          Accept contract
        </Button>
      ) : null}
      {listingish ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const res = await duplicateListing(propertyKey)
              if (res.error || !res.propertyKey) toast.error(res.error ?? 'Could not duplicate')
              else {
                toast.success('Duplicated listing.')
                router.push(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
              }
            })
          }}
        >
          Duplicate listing
        </Button>
      ) : null}
      {(stage === 'active_listing' || stage === 'pending') && others.length > 0 ? (
        <>
          <Button variant="quiet" disabled={pending} onClick={() => setMergeOpen(true)}>
            Merge listing
          </Button>
          {mergeOpen ? (
            <Dialog
              open={mergeOpen}
              onClose={() => setMergeOpen(false)}
              title="Merge another listing into this file"
              description="Cycles, people, and contacts from the other file move here. The other file is marked dead. Documents ride the cycles."
              size="work"
              footer={
                <>
                  <Button variant="quiet" onClick={() => setMergeOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={pending || !otherKey}
                    onClick={() => {
                      start(async () => {
                        const res = await mergeListingInto(propertyKey, otherKey)
                        if (res.error) toast.error(res.error)
                        else {
                          toast.success('Merged.')
                          setMergeOpen(false)
                        }
                      })
                    }}
                  >
                    Merge in
                  </Button>
                </>
              }
            >
              <div style={{ display: 'grid', gap: 8 }}>
                {others.map((d) => (
                  <ToolbarRadio
                    key={d.propertyKey}
                    name="merge-other"
                    checked={otherKey === d.propertyKey}
                    onChange={() => setOtherKey(d.propertyKey)}
                    label={`${d.address} · ${d.stage.replace(/_/g, ' ')}`}
                  />
                ))}
              </div>
            </Dialog>
          ) : null}
        </>
      ) : null}
    </span>
  )
}
