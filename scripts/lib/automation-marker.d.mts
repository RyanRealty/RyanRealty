export declare const AUTOMATION_MARKER_COOKIE: 'rr_automation'
export declare const AUTOMATION_MARKER_VALUE: '1'
export declare const INTERNAL_USER_COOKIE: 'rr_internal'
export declare const CONSENT_COOKIE: 'ryan_realty_cookie_consent'
export declare const DECLINED_CONSENT: { analytics: false; marketing: false }
export type MarkerCookie = {
  name: string
  value: string
  domain: string
  path: string
  sameSite: 'Lax'
  secure: boolean
  httpOnly: boolean
  expires: number
}
export declare function isOwnSiteHost(host: string | null | undefined): boolean
export declare function markerCookies(extraHosts?: string[]): MarkerCookie[]
export declare function plantFlagsScript(): string
export declare function automationStorageState(baseURL?: string): { cookies: MarkerCookie[]; origins: [] }
