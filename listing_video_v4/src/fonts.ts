// Font loader — CSS @font-face injection.
import { staticFile } from 'remotion';

const azo = staticFile('fonts/AzoSans-Medium.ttf');
const amboqia = staticFile('fonts/Amboqia_Boriango.otf');
const mBold = staticFile('fonts/Montserrat-Bold.ttf');
const mBlack = staticFile('fonts/Montserrat-Black.ttf');

const CSS = `
@font-face { font-family: 'Amboqia'; src: url(${amboqia}) format('opentype'); font-weight: 400 900; font-display: block; }
@font-face { font-family: 'AzoSans'; src: url(${azo}) format('truetype'); font-weight: 400 900; font-display: block; }
@font-face { font-family: 'Montserrat'; src: url(${mBold}) format('truetype'); font-weight: 700; font-display: block; }
@font-face { font-family: 'Montserrat'; src: url(${mBlack}) format('truetype'); font-weight: 900; font-display: block; }
`;

if (typeof document !== 'undefined') {
  if (!document.getElementById('listing-video-fonts')) {
    const s = document.createElement('style');
    s.id = 'listing-video-fonts';
    s.innerHTML = CSS;
    document.head.appendChild(s);
  }
}
