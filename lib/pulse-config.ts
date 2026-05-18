/**
 * Shared, non-actions config for the /pulse feed. The activity-feed server actions
 * are async by design (Next.js server-actions constraint), so static data
 * lives here and is imported wherever needed.
 */

export const PULSE_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Madras',
  'Terrebonne',
  'Black Butte Ranch',
  'Powell Butte',
  'Crooked River Ranch',
  'Culver',
] as const

export type PulseDefaultCity = (typeof PULSE_DEFAULT_CITIES)[number]
