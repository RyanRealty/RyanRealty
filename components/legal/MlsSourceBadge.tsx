import Image from 'next/image'
import { getMlsSourceMeta } from '@/lib/mls-source'

type MlsSourceBadgeProps = {
  source: string | null | undefined
  className?: string
  prefixText?: string
}

export default function MlsSourceBadge({
  source,
  className,
  prefixText = 'Listing provided by',
}: MlsSourceBadgeProps) {
  const meta = getMlsSourceMeta(source)

  return (
    <div className={className ?? ''}>
      <p className="text-xs text-muted-foreground">
        {prefixText} {meta.label}
      </p>
      {meta.logoPath ? (
        <Image
          src={meta.logoPath}
          alt={`${meta.label} logo`}
          width={140}
          height={26}
          className="mt-1 h-5 w-auto object-contain"
        />
      ) : null}
    </div>
  )
}
