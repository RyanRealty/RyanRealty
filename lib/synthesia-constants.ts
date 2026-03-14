/**
 * Synthesia defaults and avatar options for broker intro videos.
 * Shared by client (AdminBrokerForm) and server (synthesia actions).
 */

export type SynthesiaAvatarOption = {
  id: string
  name: string
  gender: 'Male' | 'Female'
  version: string
}

/** Curated list of Synthesia avatars (EXPRESS-1 and a few V3) for broker intro videos. */
export const SYNTHESIA_AVATAR_OPTIONS: SynthesiaAvatarOption[] = [
  { id: '49dc8f46-8c08-45f1-8608-57069c173827', name: 'Ada (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '2f17a7d7-bba5-4cc8-9c4e-c9e91c81dad5', name: 'Alex (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '4e904b0a-f86d-47be-b654-adc6a6db6511', name: 'Francesca (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '9fd70b49-1ab4-494e-9872-90d831ad31b7', name: 'Julia (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '277766da-bb79-4a75-9193-ed45a03b372e', name: 'Kayla (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '6381592b-36bc-448d-aca2-1ffd33611ec2', name: 'Paloma (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: 'b3d74452-7011-4e8e-b3bf-12f7406f8f22', name: 'Talia (EXPRESS-1)', gender: 'Female', version: 'EXPRESS-1' },
  { id: '894c9b8a-e3a7-40b7-b7e6-7441faceb46e', name: 'Jaz (EXPRESS-1)', gender: 'Male', version: 'EXPRESS-1' },
  { id: '0d2356ca-b688-419a-b08b-9264e5a6a94e', name: 'Joshua (EXPRESS-1)', gender: 'Male', version: 'EXPRESS-1' },
  { id: 'd3d67f0c-8932-44f4-9f6b-4809417c4489', name: 'Aaron (V3)', gender: 'Male', version: '3' },
  { id: '1bb94682-21bc-490b-b9d5-4aa21a6e130c', name: 'Alex (V3)', gender: 'Female', version: '3' },
  { id: 'ed731177-522a-440c-b77d-1ff4af8f9a02', name: 'Caroline (V3)', gender: 'Female', version: '3' },
  { id: '121a4091-0d53-401c-b13f-63127e7bd2f2', name: 'Charles (V3)', gender: 'Male', version: '3' },
]

export const DEFAULT_INTRO_PROMPT =
  "Hi, I'm [Broker Name], and I'm here to help you find your perfect home in Central Oregon. Whether you're buying or selling, I'd love to connect. Let's talk!"
