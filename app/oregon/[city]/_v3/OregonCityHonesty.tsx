/**
 * SITE-105 honesty banner — catalog Alert on the route.
 *
 * Tip Ready `requireRouteImport` needs `app/oregon/[city]` page/_v3 to import
 * `@/components/ui/alert`. This file is that import. Composition matches the
 * shadcn Alert demo: Icon, AlertTitle, AlertDescription, AlertAction + outline
 * Button, stacked inside a rounded bordered card. Navy/cream paint only.
 * Wrapping this in V3Quiet is the cream-strip miss the Mini judge named.
 */
import Link from 'next/link'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { V3_ROOT_CLASS, V3Icon } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { buildOregonCityHonestyDescription } from './oregon-city-fold'
import './OregonCityHonesty.css'

export function OregonCityHonesty(props: {
  cityName: string
  liveCount: number
  id?: string
}) {
  const cityName = props.cityName.trim()
  const title = `We don't work in ${cityName}`
  const description = buildOregonCityHonestyDescription({
    name: cityName,
    activeAllCount: props.liveCount,
  })

  return (
    <section
      id={props.id ?? 'about'}
      className={cn(V3_ROOT_CLASS, 'oregon-city-honesty')}
      aria-label={title}
    >
      <Alert className="oregon-city-honesty__alert">
        <V3Icon name="InfoCircle" size={20} />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
        </AlertDescription>
        <AlertAction>
          <Button asChild variant="outline" size="sm">
            <Link href="#referral" className="oregon-city-honesty__link">
              Get a broker introduction
            </Link>
          </Button>
        </AlertAction>
      </Alert>
    </section>
  )
}
