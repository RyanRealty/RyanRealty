'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageActionBar from './PageActionBar'
import { toggleSavedCity } from '@/app/actions/saved-cities'

type Props = {
  citySlug: string
  cityName: string
  initialSaved: boolean
  signedIn: boolean
  shareUrl: string
  /** 'bar' = full-width below hero (default). 'overlay' = compact in hero top-right. */
  variant?: 'bar' | 'overlay'
}

export default function CityPageActionBar({
  citySlug,
  cityName,
  initialSaved,
  signedIn,
  shareUrl,
  variant = 'bar',
}: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleSavedCity(citySlug)
    setPending(false)
    if (result.error === 'Not signed in') {
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')
      window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      return
    }
    if (result.error == null) setSaved(result.saved)
    router.refresh()
  }

  return (
    <PageActionBar
      saveLabel="Save city"
      saveActive={saved}
      onSave={handleSave}
      saveDisabled={pending}
      like={false}
      shareUrl={shareUrl}
      shareTitle={`Homes for sale in ${cityName}, Oregon | Ryan Realty`}
      shareText={`Explore ${cityName}, Oregon — homes for sale, communities, and neighborhoods.`}
      signedIn={signedIn}
      variant={variant}
    />
  )
}
