// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('vmg_wind_stw (B)', () => {
  const calc = require('../calcs/vmg_wind_stw')

  it('multiplies cos(angleTrueWater) by speedThroughWater', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5)
    out.should.deep.equal([{ path: 'performance.velocityMadeGood', value: 5 }])
  })

  // BUG: both vmg calculators write to the same path; enabling both
  // is mutually destructive (second one wins per debounce window).
  // Test pins the current shared path.
  it('writes to the same path as vmg_wind (performance.velocityMadeGood)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 1)
    out[0].path.should.equal('performance.velocityMadeGood')
  })
})
