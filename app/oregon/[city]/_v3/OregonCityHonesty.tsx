/**
 * SITE-105 honesty banner — catalog Alert on the route.
 *
 * Tip Ready `requireRouteImport` needs `app/oregon/[city]` page/_v3 to import
 * `@/components/ui/alert`. Composition matches the shadcn Alert demo
 * (ui.shadcn.com/docs/components/alert): Icon, AlertTitle, AlertDescription,
 * then AlertAction + outline Button stacked in flow. Not a centered cream
 * island. Not an absolute top-right chip (that clips the title at 375).
 */
import Link from 'next/link'
import { InfoIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { V3_ROOT_CLASS } from '@/components/site/v3'
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
      <Alert className="has-data-[slot=alert-action]:pr-2.5">
        <InfoIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
        </AlertDescription>
        <AlertAction className="static top-auto right-auto col-start-2 mt-1 w-max">
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
