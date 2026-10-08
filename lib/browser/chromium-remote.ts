/**
 * The Chromium pack @sparticuz/chromium-min downloads into /tmp on Vercel.
 * One constant for every renderer that runs in a function, so the PDF routes
 * and the Studio's motion stage launch the same browser build.
 */
export const CHROMIUM_REMOTE =
  'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar'
