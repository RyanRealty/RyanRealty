/**
 * load-fonts — wires the canonical Amboqia Boriango loader for this project.
 *
 * Imported once at the top of src/index.ts (Remotion entry file).
 * The project's own fonts.ts handles AzoSans + the existing `loadFonts()`
 * call chain; this module ensures the canonical `loadAmboqia()` from
 * video_production_skills/captions/canonical is also registered so
 * SingleWordCaption components render with the correct brand display font.
 *
 * Font file: video/market-report/public/Amboqia_Boriango.otf
 * (also present as Amboqia.otf for backward compat with fonts.ts reference)
 */
import { loadAmboqia } from '../../../video_production_skills/captions/canonical/load-amboqia'

loadAmboqia()
