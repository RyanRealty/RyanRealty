'use client'

import { useRouter } from 'next/navigation'
import { toggleLikeListing } from '@/app/actions/likes'

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
      <button
        type="button"
        onClick={handleClick}
        className={className ?? 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/95 p-0 shadow hover:bg-white'}
        aria-label={label}
      >
        {liked ? (
          <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? 'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50'}
      aria-label={liked ? 'Unlike this listing' : 'Like this listing'}
    >
      {liked ? (
        <>
          <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
          Liked {likeCount > 0 && `(${likeCount})`}
        </>
      ) : (
        <>
          <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          Like {likeCount > 0 && `(${likeCount})`}
        </>
      )}
    </button>
  )
}
