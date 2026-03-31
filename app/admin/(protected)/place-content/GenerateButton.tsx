'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { generatePlaceContentSingle } from '@/app/actions/generate-place-content-single'

type Props = {
  placeType: 'city' | 'community' | 'neighborhood'
  placeKey: string
  placeName: string
  cityName: string | null
}

export default function GenerateButton({ placeType, placeKey, placeName, cityName }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleGenerate() {
    startTransition(async () => {
      toast.info(`Generating content for ${placeName}...`)
      const { error } = await generatePlaceContentSingle({
        placeType,
        placeKey,
        placeName,
        cityName,
      })
      if (error) {
        toast.error(`Failed: ${error}`)
      } else {
        toast.success(`Content generated for ${placeName}`)
        router.refresh()
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={isPending}
    >
      {isPending ? 'Generating...' : 'Generate'}
    </Button>
  )
}
