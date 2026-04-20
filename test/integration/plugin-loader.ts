// Integration tests for the calc file loader (load_calcs in src/index.ts).
//
// A single calc throwing at require() time must not kill the plugin —
// the server would then start with ZERO calcs enabled, which matches
// the user-visible symptom in #236 (magneticVariation null, heading
// stops updating, etc.). These tests install a synthetic calc that
// throws the moment Node evaluates its module body, and verify that
// the remaining calcs still come up.

import * as path from 'path'
import * as fs from 'fs'
import * as chai from 'chai'
chai.should()

function installThrowingCalc(basename: string): () => void {
  const calcsDir = path.join(__dirname, '../../src/calcs')
  const fakePath = path.join(calcsDir, basename + '.ts')
  const indexPath = require.resolve('../../src')

  const origIndexCacheEntry = require.cache[indexPath]
  fs.writeFileSync(
    fakePath,
    "throw new Error('simulated require-time failure')\n"
  )

  delete require.cache[indexPath]
  delete require.cache[fakePath]

  return function cleanup() {
    try {
      fs.unlinkSync(fakePath)
    } catch {
      // ignore — file may already be gone
    }
    delete require.cache[fakePath]
    delete require.cache[indexPath]
    if (origIndexCacheEntry) require.cache[indexPath] = origIndexCacheEntry
  }
}

function makeApp(errors: string[] = []): any {
  return {
    selfId: 'self',
    streambundle: {
      getSelfStream: () => ({
        toProperty: () => ({ map: () => ({}), combine: () => ({}) })
      })
    },
    handleMessage: () => {},
    debug: () => {},
    error: (msg: string) => errors.push(msg),
    setPluginStatus: () => {},
    setPluginError: () => {},
    getSelfPath: () => undefined,
    registerDeltaInputHandler: () => {},
    signalk: { self: 'vessels.self' }
  }
}

describe('plugin index.js — load_calcs resilience', () => {
  it('does not propagate a require-time throw from one calc', () => {
    const cleanup = installThrowingCalc('__test_throwing_calc')
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const plugin = require('../../src')(makeApp())
      // schema() is what actually triggers load_calcs. Without the
      // loader guard this throws and we never get here.
      const schema = plugin.schema()
      schema.should.be.an('object')
      // The other ~35 real calcs must still be present — proving that
      // the loader isolated the failing module instead of aborting.
      Object.keys(schema.properties).length.should.be.greaterThan(5)
    } finally {
      cleanup()
    }
  })

  it('logs an error mentioning the failing calc filename', () => {
    const errors: string[] = []
    const cleanup = installThrowingCalc('__test_throwing_named')
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const plugin = require('../../src')(makeApp(errors))
      plugin.schema()
      errors
        .some((e) => e.includes('__test_throwing_named'))
        .should.equal(
          true,
          'expected app.error to be called with the failing filename'
        )
    } finally {
      cleanup()
    }
  })
})
