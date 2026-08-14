import type { ComponentType } from 'react'
import { V3Breadcrumb, type V3Crumb } from '@/components/site/v3'

type StageProps = {
  id?: string
  headingLevel?: 1 | 2
  height?: 'standard' | 'tall' | 'compact'
  eyebrow?: string
  headline: string
  posterSrc: string
  action: { label: string; href: string }
}

export function CommunityStage(props: {
  Stage: ComponentType<StageProps>
  trail: readonly V3Crumb[]
  name: string
  cityName: string
  headline: string
  posterSrc: string
  action: { label: string; href: string }
}) {
  const Stage = props.Stage
  return (
    <>
      <V3Breadcrumb tone="on-media" trail={props.trail} />
      <Stage
        id="place"
        headingLevel={1}
        height="tall"
        eyebrow={`${props.name} · ${props.cityName}`}
        headline={props.headline}
        posterSrc={props.posterSrc}
        action={props.action}
      />
    </>
  )
}
