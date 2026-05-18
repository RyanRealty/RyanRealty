'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProducerRecord, ProducerStatus } from '@/lib/producer-catalog'

const STATUS_CLASSES: Record<ProducerStatus, string> = {
  locked: 'bg-success/10 text-success border-success/20',
  draft: 'bg-warning/10 text-warning border-warning/20',
  needs_tool: 'bg-destructive/10 text-destructive border-destructive/20',
  needs_oauth: 'bg-accent/10 text-accent-foreground border-accent/20',
}

const STATUS_LABELS: Record<ProducerStatus, string> = {
  locked: 'Locked',
  draft: 'Draft',
  needs_tool: 'Needs Tool',
  needs_oauth: 'Needs OAuth',
}

interface ProducerCardProps {
  producer: ProducerRecord
}

export function ProducerCard({ producer }: ProducerCardProps) {
  const thumbs = producer.exampleOutputs.slice(0, 4)
  const placeholder = '/admin/producers/_placeholder.png'

  return (
    <Link href={`/admin/producers/${producer.slug}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="pb-2">
          {/* Thumbnail strip */}
          <div className="mb-3 flex gap-1.5 overflow-hidden rounded-md">
            {(thumbs.length > 0 ? thumbs : [placeholder]).map((src, i) => (
              <div
                key={i}
                className={cn(
                  'relative overflow-hidden rounded bg-muted',
                  thumbs.length <= 1 ? 'h-20 w-full' : 'h-16 flex-1',
                )}
              >
                <Image
                  src={src.startsWith('http') || src.startsWith('/') ? src : placeholder}
                  alt={`${producer.name} example ${i + 1}`}
                  fill
                  className="object-cover"
                  unoptimized={src.startsWith('http')}
                  onError={undefined}
                />
              </div>
            ))}
          </div>

          {/* Name + status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-foreground" style={{ fontWeight: 600 }}>
              {producer.name}
            </h3>
            <Badge
              variant="outline"
              className={cn('shrink-0 text-xs', STATUS_CLASSES[producer.status])}
            >
              {STATUS_LABELS[producer.status]}
            </Badge>
          </div>

          {/* Section badge */}
          <Badge variant="secondary" className="mt-1 w-fit text-xs">
            {producer.sectionLabel}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Description */}
          <p className="line-clamp-2 text-sm text-muted-foreground">{producer.description}</p>

          {/* Required inputs */}
          {producer.requiredInputs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {producer.requiredInputs.slice(0, 4).map((inp) => (
                <Badge key={inp} variant="outline" className="text-xs text-muted-foreground">
                  {inp}
                </Badge>
              ))}
              {producer.requiredInputs.length > 4 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{producer.requiredInputs.length - 4} more
                </Badge>
              )}
            </div>
          )}

          {/* Action types */}
          {producer.actionTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {producer.actionTypes.slice(0, 3).map((at) => (
                <Badge key={at} className="bg-primary/10 text-xs text-primary hover:bg-primary/10">
                  {at}
                </Badge>
              ))}
              {producer.actionTypes.length > 3 && (
                <Badge className="bg-primary/10 text-xs text-primary hover:bg-primary/10">
                  +{producer.actionTypes.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
