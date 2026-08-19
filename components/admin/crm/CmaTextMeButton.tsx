'use client'

import Link from 'next/link'
import { Button } from '@/components/admin/v2'

export function CmaTextMeButton({
  slug,
  label = 'Text me this CMA',
  fullWidth = true,
}: {
  slug: string
  label?: string
  fullWidth?: boolean
}) {
  const href = `/admin/messages/new?self=1&channel=text&cma=${encodeURIComponent(slug)}`
  return (
    <Link href={href} className={fullWidth ? 'w-full' : undefined} style={{ textDecoration: 'none' }}>
      <Button type="button" variant="quiet" touch className={fullWidth ? 'w-full' : undefined} disabled={!slug}>
        {label}
      </Button>
    </Link>
  )
}
