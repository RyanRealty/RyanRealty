import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
Config.setChromiumOpenGlRenderer('angle')
Config.setConcurrency(2)
Config.setChromiumHeadlessMode(true)
Config.setDelayRenderTimeoutInMilliseconds(120_000)
