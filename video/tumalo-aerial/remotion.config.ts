import fs from 'fs';
import path from 'path';
import { Config } from '@remotion/cli/config';

/** Read Maps API key from repo-root `.env.local` and mirror into project `.env` for Remotion's loader. */
function syncGoogleMapsKeyIntoProjectEnv(): void {
  // Use cwd (Remotion project root), not `__dirname` — compiled config may live elsewhere.
  const projectRoot = process.cwd();
  const rootEnv = path.join(projectRoot, '../../.env.local');
  if (!fs.existsSync(rootEnv)) return;
  let remotionKey = '';
  let nextPublicKey = '';
  for (const line of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq < 1) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === 'REMOTION_GOOGLE_MAPS_KEY') remotionKey = val;
    if (key === 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY') nextPublicKey = val;
  }
  const key = (remotionKey || nextPublicKey).trim();
  if (!key) return;
  fs.writeFileSync(
    path.join(projectRoot, '.env'),
    `REMOTION_GOOGLE_MAPS_KEY=${key}\n`,
    'utf8',
  );
}

syncGoogleMapsKeyIntoProjectEnv();

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(1);
Config.setChromiumHeadlessMode(true);
// Google Photorealistic 3D Tiles can exceed the default 30s warm-up on first
// frame — especially for the Aubrey Butte wide pan which has to stream a huge
// swath of terrain. Match the jackstraw_video project timeout.
Config.setDelayRenderTimeoutInMilliseconds(240_000);

// The `3d-tiles-renderer` npm package ships raw JSX (not compiled JS) in its
// /r3f and /src/r3f paths. Remotion's default webpack rule excludes
// node_modules from the JSX loader, so we bolt on an extra rule that
// processes that specific package through esbuild. Without this, the first
// import of `3d-tiles-renderer/r3f` hits a webpack "unexpected token" error
// on the JSX inside forwardRef components.
Config.overrideWebpackConfig((config) => {
  const pathMod = require('path') as typeof path;
  const esbuildLoader = require.resolve(
    '@remotion/bundler/dist/esbuild-loader/index.js',
  );
  const esbuild = require('esbuild');
  const remotionRoot = process.cwd();
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.jsx$/,
          include: /node_modules\/3d-tiles-renderer/,
          use: [
            {
              loader: esbuildLoader,
              options: {
                target: 'chrome85',
                loader: 'jsx',
                implementation: esbuild,
                remotionRoot,
              },
            },
          ],
        },
      ],
    },
  };
});
