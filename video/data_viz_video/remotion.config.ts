import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setChromiumOpenGlRenderer('angle')
Config.setConcurrency(1)
Config.setChromiumHeadlessMode(true)
Config.setDelayRenderTimeoutInMilliseconds(120_000)
