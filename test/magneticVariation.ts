import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('magneticVariation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/magneticVariation')

  it('emits a source field reflecting the WMM model name', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ latitude: 39.06, longitude: -76.48 })
    const src = out.find(
      (x: { path: string }) => x.path === 'navigation.magneticVariation.source'
    )
    src.should.exist
    src.value.should.be.a('string')
    src.value.should.not.include('-') // spaces instead of dashes
  })
})

// The WMM model build lives at module scope for perf reasons, but the
// geomagnetism package can throw from .model() (bundler dropped the
// coefficients, corrupt install, future API break). If that throw
// escapes module evaluation, the plugin loader in src/index.ts dies
// and takes *every* other calc down with it — which is exactly what
// #236 looks like. These tests pin the contract: module eval must
// survive, and the calculator must no-op rather than crash.
describe('magneticVariation — geomagnetism load failure', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const geomag: any = require('geomagnetism')
  const magVarPath = require.resolve('../src/calcs/magneticVariation')
  let originalModel: any

  beforeEach(() => {
    originalModel = geomag.model
  })

  afterEach(() => {
    geomag.model = originalModel
    delete require.cache[magVarPath]
  })

  it('does not throw at require-time when geomagnetism.model() fails', () => {
    geomag.model = () => {
      throw new Error('simulated geomagnetism failure')
    }
    delete require.cache[magVarPath]

    let factory: any
    const doRequire = () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      factory = require('../src/calcs/magneticVariation')
    }
    doRequire.should.not.throw()

    // Calculator must degrade to undefined instead of throwing on
    // every position fix, so headingTrue and friends can detect the
    // absence and skip their own emit.
    const d = factory(makeApp(), makePlugin())
    const out = d.calculator({ latitude: 39.06, longitude: -76.48 })
    expect(out).to.be.undefined
  })
})
