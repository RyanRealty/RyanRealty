'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageActionBar from './PageActionBar'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { toggleCommunityLike } from '@/app/actions/community-engagement'

type Props = {
  entityKey: string
  communityName: string
  cityName: string
  initialSaved: boolean
  initialLiked: boolean
  signedIn: boolean
  shareUrl: string
  /** 'bar' = full-width below hero (default). 'overlay' = compact in hero top-right. */
  variant?: 'bar' | 'overlay'
}

export default function CommunityPageActionBar({
  entityKey,
  communityName,
  cityName,
  initialSaved,
  initialLiked,
  signedIn,
  shareUrl,
  variant = 'bar',
}: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [liked, setLiked] = useState(initialLiked)
  const [pending, setPending] = useState(false)

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleSavedCommunity(entityKey)
    setPending(false)
    if (result.error === 'Not signed in') {
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')
      window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      return
    }
    if (result.error == null) setSaved(result.saved)
    router.refresh()
  }

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleCommunityLike(entityKey)
    setPending(false)
    if (result.error == null) setLiked(result.liked)
    router.refresh()
  }

  return (
    <PageActionBar
      saveLabel="Save community"
      saveActive={saved}
      onSave={handleSave}
      saveDisabled={pending}
      like
      likeActive={liked}
      onLike={handleLike}
      likeDisabled={pending}
      shareUrl={shareUrl}
      shareTitle={`${communityName} homes for sale | ${cityName}, Oregon | Ryan Realty`}
      shareText={`Explore ${communityName} in ${cityName}, Oregon — homes for sale and community info.`}
      showShare={true}
      signedIn={signedIn}
      variant={variant}
    />
  )
}
