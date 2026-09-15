/**
 * SITE-105 honesty banner — catalog Alert pixels, not house paint.
 *
 * Composition is the shadcn Alert demo (ui.shadcn.com/docs/components/alert):
 * relative Alert, Icon, AlertTitle, AlertDescription, AlertAction with the
 * installed outline Button. No Quiet wrap. No Action restack. No extra
 * className on Alert or AlertAction.
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
          <Button asChild variant="outline">
            <Link href="#referral">Introduce</Link>
          </Button>
        </AlertAction>
      </Alert>
    </section>
  )
}
