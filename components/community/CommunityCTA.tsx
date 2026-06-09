'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trackCtaClick } from '@/lib/cta-tracking'
import { Button } from "@/components/ui/button"
import { H2 } from '@/components/site/primitives'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type Props = {
  communityName: string
  slug: string
}

export default function CommunityCTA({ communityName, slug }: Props) {
  const [showModal, setShowModal] = useState(false)

  function handleGetNotified() {
    trackCtaClick({
      label: 'Get Notified of New Listings',
      destination: '/account/saved-communities',
      context: `community_cta:${slug}`,
    })
  }

  function handleTalkExpert() {
    trackCtaClick({
      label: 'Talk to a Local Expert',
      destination: '#community-contact-modal',
      context: `community_cta:${slug}`,
    })
    setShowModal(true)
  }

  return (
    <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <H2 id="community-cta-heading" className="text-2xl text-primary-foreground">
          Interested in {communityName}?
        </H2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button
            asChild
            onClick={handleGetNotified}
          >
            <Link href="/account/saved-communities">
              Get Notified of New Listings
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTalkExpert}
          >
            Talk to a Local Expert
          </Button>
        </div>
        <p className="mt-4 text-sm text-primary-foreground/80">
          Sign in to save this community and get alerts when new homes hit the market.
        </p>
      </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact an expert</DialogTitle>
            <DialogDescription>
              We&apos;ll connect you with a local agent who knows {communityName}. Contact form coming soon.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </section>
  )
}
