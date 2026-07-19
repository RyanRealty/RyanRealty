'use client'

import { useState } from 'react'
import type { BrokerRow } from '@/app/actions/brokers'
import type { BrokerGeneratedMediaRow } from '@/app/actions/broker-generated-media'
import BrokerProfileForm from './broker/BrokerProfileForm'
import BrokerHeadshotStudio from './broker/BrokerHeadshotStudio'
import BrokerVideoStudio from './broker/BrokerVideoStudio'

/** Shared status-banner message type, bridged from the parent down into all three concern components. */
export type BrokerFormMessage = { type: 'ok' | 'err'; text: string } | null

type Props = {
  broker: BrokerRow
  initialGeneratedMedia?: BrokerGeneratedMediaRow[]
  className?: string
}

/**
 * Thin composition root for the broker admin editor. Splits three previously-conflated concerns
 * into sibling components:
 *  - BrokerProfileForm    profile CRUD (updateBroker / deleteBroker)
 *  - BrokerHeadshotStudio AI headshot prompt library (upload / generate / save / set-default)
 *  - BrokerVideoStudio    Synthesia intro-video generation + saved media library
 *
 * This parent owns only the state that is genuinely cross-cutting:
 *  - `message`: the single shared status banner every concern writes to (matches the former
 *    single-banner layout exactly).
 *  - `photoUrl` / `introVideoUrl`: these are persisted broker-profile fields (submitted by
 *    BrokerProfileForm's Save action) but are also mutated as side effects of headshot/video
 *    studio actions (upload, generate + set-as-default, set-as-intro, delete-resets-intro). Since
 *    all three concerns need to read and/or write these two fields to stay in sync with what will
 *    actually be saved, they cannot be cleanly owned by a single child without re-introducing
 *    prop-drilling in the other direction. Everything else (all other profile fields, the prompt
 *    library, the generated-media list, etc.) is owned entirely by its respective child.
 *
 * BrokerHeadshotStudio and BrokerVideoStudio are passed as `children` to BrokerProfileForm so they
 * render at the same DOM position as the original monolith (between "Years of experience" and the
 * "Photo URL / Email" grid), preserving the original visual layout exactly.
 */
export default function AdminBrokerForm({ broker, initialGeneratedMedia = [], className = '' }: Props) {
  const [message, setMessage] = useState<BrokerFormMessage>(null)
  const [photoUrl, setPhotoUrl] = useState(broker.photo_url ?? '')
  const [introVideoUrl, setIntroVideoUrl] = useState(broker.intro_video_url ?? '')

  return (
    <div className={`space-y-6 rounded-lg border border-border bg-card p-6 ${className}`}>
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}
      <BrokerProfileForm
        broker={broker}
        photoUrl={photoUrl}
        onPhotoUrlChange={setPhotoUrl}
        introVideoUrl={introVideoUrl}
        setMessage={setMessage}
      >
        <BrokerHeadshotStudio
          broker={broker}
          photoUrl={photoUrl}
          onPhotoUrlChange={setPhotoUrl}
          setMessage={setMessage}
        />
        <BrokerVideoStudio
          broker={broker}
          initialGeneratedMedia={initialGeneratedMedia}
          introVideoUrl={introVideoUrl}
          onIntroVideoUrlChange={setIntroVideoUrl}
          setMessage={setMessage}
        />
      </BrokerProfileForm>
    </div>
  )
}
