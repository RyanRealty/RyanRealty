'use client'

import { useRouter } from 'next/navigation'
import { toggleLikeListing } from '@/app/actions/likes'
import { HeartIcon } from '@/components/icons/ActionIcons'
import { Button } from "@/components/ui/button"

type Props = {
  listingKey: string
  liked: boolean
  likeCount?: number
  variant?: 'default' | 'compact'
  className?: string
}

export default function LikeButton({ listingKey, liked, likeCount = 0, variant = 'default', className }: Props) {
  const router = useRouter()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await toggleLikeListing(listingKey)
    router.refresh()
  }

  const compact = variant === 'compact'
  const label = liked ? 'Unlike' : 'Like'

  if (compact) {
    return (
      <Button
        type="button"
        onClick={handleClick}
        className={className ?? 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-card/95 p-0 shadow hover:bg-card'}
        aria-label={label}
      >
        <HeartIcon filled={liked} className={`h-5 w-5 ${liked ? 'text-destructive' : 'text-muted-foreground'}`} />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      className={className ?? 'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted'}
      aria-label={liked ? 'Unlike this listing' : 'Like this listing'}
    >
      {liked ? (
        <>
          <HeartIcon filled className="h-5 w-5 text-destructive" />
          Liked {likeCount > 0 && `(${likeCount})`}
        </>
      ) : (
        <>
          <HeartIcon filled={false} className="h-5 w-5 text-muted-foreground" />
          Like {likeCount > 0 && `(${likeCount})`}
        </>
      )}
    </Button>
  )
}
