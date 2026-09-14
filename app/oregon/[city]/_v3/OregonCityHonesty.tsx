/**
 * SITE-105 honesty banner — catalog Alert on the route.
 *
 * Tip Ready `requireRouteImport` needs `app/oregon/[city]` page/_v3 to import
 * `@/components/ui/alert`. House-only import in V3Quiet is not enough. This
 * file is that import, and it renders the catalog object (icon, rounded
 * bordered container, title, description, AlertAction + outline Button) in
 * navy/cream. Do not flatten it back to a Quiet hairline strip.
 */
import Link from 'next/link'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { V3_ROOT_CLASS, V3Icon } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import '@/components/site/v3/V3Quiet.css'
import { buildOregonCityHonestyDescription } from './oregon-city-fold'

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
      className={cn(V3_ROOT_CLASS, 'v3-quiet', 'v3-quiet--headless', 'v3-quiet--alert')}
      aria-label={title}
    >
      <Alert className="v3-quiet__alert">
        <V3Icon name="InfoCircle" size={16} className="v3-quiet__alert-icon" />
        <AlertTitle className="v3-quiet__alert-title">{title}</AlertTitle>
        <AlertDescription className="v3-quiet__alert-body">
          <p>{description}</p>
        </AlertDescription>
        <AlertAction className="v3-quiet__alert-action">
          <Button asChild variant="outline" size="sm">
            <Link href="#referral" className="v3-quiet__alert-link">
              Get a broker introduction
            </Link>
          </Button>
        </AlertAction>
      </Alert>
    </section>
  )
}
