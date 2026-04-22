// Headless-safe Google Fonts via @remotion/google-fonts (FontFace API + bounded
// timeouts). The old <link rel=stylesheet> + document.fonts.ready path often
// never fired `onload` in Chromium during `remotion render`, leaving
// delayRender() open until the global timeout (~238s).

import { continueRender, delayRender } from 'remotion';
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as loadBarlow } from '@remotion/google-fonts/Barlow';

const handle = delayRender('cascade-peaks-fonts');

const { waitUntilDone: serifNormal } = loadCormorant('normal', {
  weights: ['400', '600'],
  subsets: ['latin'],
});
const { waitUntilDone: serifItalic } = loadCormorant('italic', {
  weights: ['400'],
  subsets: ['latin'],
});
const { waitUntilDone: body } = loadBarlow('normal', {
  weights: ['500', '600'],
  subsets: ['latin'],
});

void Promise.all([serifNormal(), serifItalic(), body()])
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
