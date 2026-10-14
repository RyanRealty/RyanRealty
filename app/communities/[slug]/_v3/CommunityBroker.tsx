import { V3_ROOT_CLASS, V3Button, V3Heading } from '@/components/site/v3'
import type { CommunityBrokerBlock } from './community-broker'

export function CommunityBroker({
  block,
  id = 'broker',
}: {
  block: CommunityBrokerBlock
  id?: string
}) {
  return (
    <section id={id} className={`${V3_ROOT_CLASS} community-broker`} aria-labelledby="broker-heading">
      <V3Heading level={2} id="broker-heading">
        {block.heading}
      </V3Heading>
      <p className="community-broker__body">
        {block.body}{' '}
        <a href={block.href}>
          {block.name}, {block.title}
        </a>
        .
      </p>
      <V3Button href={block.href} variant="primary">
        {block.name}
      </V3Button>
    </section>
  )
}
