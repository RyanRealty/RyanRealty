import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  /** Author display name */
  name: string
  /** Author role/title (e.g., "Principal Broker", "Market Analyst") */
  role?: string
  /** Author avatar/headshot URL */
  imageUrl?: string | null
  /** Professional credentials (e.g., "OR Licensed Broker #12345") */
  credentials?: string
  /** Optional link to author's profile page */
  profileUrl?: string
  /** Date of publication or last update */
  date?: string | null
  /** Reading time estimate */
  readingTime?: string
  /** Compact mode for inline display */
  compact?: boolean
  /** Additional className */
  className?: string
}

/**
 * AuthorByline — displays author attribution with credentials for E-E-A-T signals.
 *
 * Critical for:
 * - Google's YMYL (Your Money Your Life) content evaluation
 * - LLM/AI citation authority
 * - User trust and credibility
 *
 * Used on blog posts, guides, market reports, and community descriptions.
 */
export default function AuthorByline({
  name,
  role,
  imageUrl,
  credentials,
  profileUrl,
  date,
  readingTime,
  compact,
  className,
}: Props) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const Wrapper = profileUrl ? 'a' : 'div'
  const wrapperProps = profileUrl ? { href: profileUrl } : {}

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Avatar className="h-6 w-6">
          {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <span>
          By <span className="font-medium text-foreground">{name}</span>
          {formattedDate && <> · {formattedDate}</>}
          {readingTime && <> · {readingTime}</>}
        </span>
      </div>
    )
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card p-4',
        profileUrl && 'transition hover:bg-muted cursor-pointer',
        className
      )}
    >
      <Avatar className="h-12 w-12 shrink-0">
        {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{name}</p>
          {role && <Badge variant="secondary" className="text-xs">{role}</Badge>}
        </div>
        {credentials && (
          <p className="mt-0.5 text-xs text-muted-foreground">{credentials}</p>
        )}
        {(formattedDate || readingTime) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formattedDate && <>Published {formattedDate}</>}
            {formattedDate && readingTime && <> · </>}
            {readingTime && <>{readingTime}</>}
          </p>
        )}
      </div>
    </Wrapper>
  )
}
