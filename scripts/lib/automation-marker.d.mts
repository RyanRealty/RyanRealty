export declare const AUTOMATION_MARKER_COOKIE: 'rr_automation'
export declare const AUTOMATION_MARKER_VALUE: '1'
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
export declare function markerCookies(extraHosts?: string[]): MarkerCookie[]
export declare function automationStorageState(baseURL?: string): { cookies: MarkerCookie[]; origins: [] }
