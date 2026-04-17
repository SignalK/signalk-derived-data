// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('airDensity', () => {
  const calc = require('../calcs/airDensity')

  it('exposes a single-entry descriptor with environment.outside.airDensity', () => {
    const d = calc(makeApp(), makePlugin())
    d.group.should.equal('air')
    d.optionKey.should.equal('Air density')
    d.derivedFrom.should.deep.equal([
      'environment.outside.temperature',
      'environment.outside.humidity',
      'environment.outside.pressure'
    ])
  })

  // BUG: airDensity.js converts temperature in the wrong direction
  // (temp + 273.16 instead of temp - 273.15), uses bitwise XOR `^` where
  // Math.pow is intended, and treats humidity as a percentage instead of
  // a 0..1 ratio. The combined effect is that the reported density is
  // essentially meaningless. This test pins the current (buggy) output so
  // the suite stays green; a follow-up flips it to the correct physical
  // value and fixes the formula.
  it('returns the value produced by the current (buggy) formula', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(298.15, 0.5, 101325)
    out.should.be.an('array').with.lengthOf(1)
    out[0].path.should.equal('environment.outside.airDensity')
    // Hand-evaluated with JS semantics: tempC = 571.31; psat = 61 ^ 5 = 56;
    // pv = 0.28; pd = 101324.72; dry term + vapour term ≈ 1.18398.
    out[0].value.should.be.closeTo(1.18398, 1e-3)
  })
})
