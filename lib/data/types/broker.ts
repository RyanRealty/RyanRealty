/**
 * Broker types. Three active brokers as of 2026-05-22:
 *   - matt-ryan (Matt Ryan, Principal)
 *   - paul-stevenson (Paul Stevenson)
 *   - rebecca-ryser-peterson (Rebecca Ryser Peterson)
 */

import type { Slug } from './shared'

export type BrokerSlug = 'matt-ryan' | 'paul-stevenson' | 'rebecca-ryser-peterson'

export type Broker = {
  slug: BrokerSlug
  fullName: string
  title: string
  email: string | null
  phoneDirect: string | null   // dotted format e.g. 541.213.6706
  phoneFub: string | null      // FUB-tracked bio phone
  headshotPng: string          // /images/brokers/<slug>.png (transparent PNG)
  headshotJpg: string          // /images/brokers/<slug>.jpg (legacy white-bg fallback)
  licenseNumber: string | null
  bio: string | null
  isPrincipal: boolean
}
