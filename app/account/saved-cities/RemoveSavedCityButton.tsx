'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unsaveCity } from '@/app/actions/saved-cities'
import { Button } from "@/components/ui/button"

type Props = { citySlug: string }

export default function RemoveSavedCityButton({ citySlug }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      await unsaveCity(citySlug)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      className="text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove'}
    </Button>
  )
}
