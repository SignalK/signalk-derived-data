import * as chai from 'chai'
chai.should()

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
