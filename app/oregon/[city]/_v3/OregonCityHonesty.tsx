/**
 * SITE-105 honesty banner — catalog Alert on the route.
 *
 * Tip Ready `requireRouteImport` needs `app/oregon/[city]` page/_v3 to import
 * `@/components/ui/alert`. Composition matches the shadcn Alert demo
 * (ui.shadcn.com/docs/components/alert): Icon, AlertTitle, AlertDescription,
 * AlertAction + outline Button. No cream box around it. AlertAction stays
 * `absolute top-2 right-2` from the installed GitHub source.
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
      <Alert>
        <InfoIcon />
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
