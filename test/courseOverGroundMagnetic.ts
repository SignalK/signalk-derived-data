import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('courseOverGroundMagnetic (extra branches)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/courseOverGroundMagnetic')

  it('returns undefined while magneticVariation is still the 9999 sentinel', () => {
    // Before the stream has produced a real magneticVariation, the
    // toProperty default of 9999 fires. Previously the calc fell back to
    // app.getSelfPath on every tick; we now skip the conversion until a
    // real value arrives via the stream.
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5, 9999)
    ;(typeof out).should.equal('undefined')
  })

  it('computes a valid result', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(1.0, 0.1)
    out[0].value.should.be.closeTo(0.9, 1e-9)
  })

  it('wraps negative results into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, 0.3)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.2, 1e-9)
  })

  it('wraps results above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, -0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})
