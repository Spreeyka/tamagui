import {
  TamaguiOptions,
  createExtractor,
  extractToClassNames,
  getPragmaOptions,
} from '@tamagui/static'
import type { LoaderContext } from 'webpack'

Error.stackTraceLimit = Infinity

// pass loader as path
const CSS_LOADER_PATH = require.resolve('./css')

Error.stackTraceLimit = Infinity
const extractor = createExtractor()

let index = 0

process.env.TAMAGUI_TARGET = 'web'

export const loader = async function loader(
  this: LoaderContext<TamaguiOptions>,
  sourceIn: Buffer | string
) {
  this.cacheable(true)
  const callback = this.async()
  const source = sourceIn.toString()

  try {
    const options: TamaguiOptions = {
      // @ts-ignore
      platform: 'web',
      ...this.getOptions(),
    }
    const sourcePath = `${this.resourcePath}`

    const { shouldDisable, shouldPrintDebug } = getPragmaOptions({
      source,
      path: sourcePath,
    })

    if (shouldPrintDebug === 'verbose') {
      console.warn(`\n\n --- Incoming source --- \n\n`)
      console.warn(source)
    }

    if (shouldDisable) {
      if (shouldPrintDebug) {
        // biome-ignore lint/suspicious/noConsoleLog: ok
        console.log('Disabling on file via pragma')
      }
      return callback(null, source)
    }

    const cssPath = `${sourcePath}.${index++}.tamagui.css`

    const extracted = await extractToClassNames({
      extractor,
      source,
      sourcePath,
      options,
      shouldPrintDebug,
    })

    if (!extracted) {
      return callback(null, source)
    }

    // add import to css
    if (extracted.styles) {
      const cssQuery = `cssData=${Buffer.from(extracted.styles).toString('base64')}`
      const remReq = this.remainingRequest
      const importPath = `${cssPath}!=!${CSS_LOADER_PATH}?${cssQuery}!${remReq}`
      extracted.js = `${extracted.js}\n\nrequire(${JSON.stringify(importPath)})`
    }

    callback(null, extracted.js, extracted.map)
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)

    console.error('Tamagui Webpack Loader Error:\n', `  ${message}\n`)

    if (message.includes('Cannot create proxy')) {
      // biome-ignore lint/suspicious/noConsoleLog: ok
      console.log(
        'This is usually due to components not loading at build-time. Check for logs just below the line above:'
      )
    }

    callback(null, source)
  }
}
