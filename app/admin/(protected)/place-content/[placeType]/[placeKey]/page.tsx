import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getPlaceContent } from '@/app/actions/place-content'
import { Badge } from '@/components/ui/badge'
import PlaceContentEditor from './PlaceContentEditor'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ placeType: string; placeKey: string }>
}

export default async function PlaceContentEditPage({ params }: Props) {
  const session = await getSession()
  const { placeType, placeKey } = await params
  const decodedKey = decodeURIComponent(placeKey)

  if (!['city', 'community', 'neighborhood'].includes(placeType)) {
    notFound()
  }

  const content = await getPlaceContent(
    placeType as 'city' | 'community' | 'neighborhood',
    decodedKey
  )

  if (!content) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{content.place_type}</Badge>
            <h1 className="text-2xl font-bold text-foreground">{content.place_name}</h1>
            {content.city_name && (
              <span className="text-muted-foreground">({content.city_name})</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit landing page content. Changes save automatically.
          </p>
        </div>
        <Link href="/admin/place-content" className="text-sm text-muted-foreground underline">
          ← Back to list
        </Link>
      </div>

      <PlaceContentEditor content={content} userId={session?.user?.id ?? 'admin'} />
    </div>
  )
}
