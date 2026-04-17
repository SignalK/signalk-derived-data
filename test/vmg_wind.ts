// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('vmg_wind (A)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/vmg_wind')

  // BUG: frame mismatch — uses environment.wind.angleTrueWater (water
  // frame) alongside navigation.speedOverGround (ground frame). The
  // sister module vmg_wind_stw uses the matching water-frame pair.
  it('multiplies cos(angleTrueWater) by speedOverGround (frame mismatch)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5)
    out.should.deep.equal([{ path: 'performance.velocityMadeGood', value: 5 }])
  })

  it('is negative when wind is abaft the beam', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(Math.PI, 5)
    out[0].value.should.be.closeTo(-5, 1e-9)
  })
})
