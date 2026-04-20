import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('courseOverGroundTrue (extra branches)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/courseOverGroundTrue')

  it('returns undefined while magneticVariation is still the 9999 sentinel', () => {
    // Before the stream has produced a real magneticVariation, the
    // toProperty default of 9999 fires. Previously the calc fell back to
    // app.getSelfPath on every tick; we now skip the conversion until a
    // real value arrives via the stream.
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(0.5, 9999)).to.equal(undefined)
  })

  it('wraps negative sums into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, -0.2)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('wraps sums above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, 0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})
