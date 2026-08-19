'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { textCmaReviewLinkToMeAction } from '@/app/actions/cma-admin'

export function CmaTextMeButton({
  slug,
  label = 'Text me this CMA',
  fullWidth = true,
}: {
  slug: string
  label?: string
  fullWidth?: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="quiet"
      touch
      className={fullWidth ? 'w-full' : undefined}
      disabled={pending || !slug}
      onClick={() => {
        startTransition(async () => {
          const { error } = await textCmaReviewLinkToMeAction(slug)
          if (error) toast.error(error)
          else toast.success('Review link texted to your phone.')
        })
      }}
    >
      {pending ? 'Texting you…' : label}
    </Button>
  )
}
