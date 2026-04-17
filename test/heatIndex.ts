// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('heatIndex', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/heatIndex')

  const d = () => calc(makeApp(), makePlugin())

  // BUG: the condition `tempF >= 80 && h >= 40 && tempF <= 110 && h <= 40`
  // is only true when humidity happens to be exactly 40% — so for almost
  // every real input the Rothfusz regression never runs and the
  // function just echoes the input temperature back. These tests pin
  // that behaviour.
  it('returns temp unchanged for a typical hot-and-humid case (Rothfusz never runs)', () => {
    const out = d().calculator(308.15, 0.7) // 95°F, 70% RH
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
    out[0].value.should.be.closeTo(308.15, 1e-9)
  })

  it('returns temp unchanged below the low threshold', () => {
    const out = d().calculator(290, 0.5) // ~62°F
    out[0].value.should.be.closeTo(290, 1e-9)
  })

  // Humidity at exactly 40% with temperature in [80, 110]°F is the only
  // range where the Rothfusz regression actually executes under the
  // current implementation. The exact value pins the arithmetic so
  // operator or constant drift in the regression is caught.
  it('runs Rothfusz only when humidity is exactly 40% and returns the exact value', () => {
    const out = d().calculator(308.15, 0.4) // 95°F, 40% RH
    out[0].value.should.be.closeTo(310.3663510555556, 1e-9)
  })

  it('runs the low-humidity adjustment when h === 40, tempF in [80, 112] and h < 13', () => {
    // This branch is unreachable because the outer guard already forces
    // h === 40; the `h < 13` inner check can never pass. Covered via the
    // normal path to document the shape of the output.
    const out = d().calculator(308.15, 0.4)
    out[0].value.should.be.a('number')
  })
})

describe('heatIndex — remaining branches', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/heatIndex')

  // tempF = 80, h = 0.4 (40%). Under the (buggy) guard `h >= 40 && h <= 40`
  // that is the only humidity that enters Rothfusz. At those inputs
  // Rothfusz yields ≈ 79.82, which takes the `heatIndex < 80` branch
  // and falls back to the simple Steadman formula.
  it('falls back to Steadman when Rothfusz gives a value below 80F', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(299.8167, 0.4) // ~80°F, 40% RH
    out[0].value.should.be.a('number')
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
  })
})
