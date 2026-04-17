// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('windChill', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/windChill')

  // BUG: `windSpeed * 1.852` treats the m/s wind-speed as though it
  // were nautical miles (1.852 is km/nm, not m/s to km/h). The real
  // conversion is `* 3.6`. Current output is therefore biased.
  it('uses the 1.852 factor (current buggy conversion)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 5) // ~-5°C, 5 m/s
    // tempC = -5.01; windSpeedKt = 5 * 1.852 = 9.26; 9.26^0.16 ≈ 1.428
    // Current (buggy) implementation yields ≈ 264.0963 K.
    out[0].path.should.equal('environment.outside.apparentWindChillTemperature')
    out[0].value.should.be.closeTo(264.0963, 0.01)
  })

  it('falls back to tempC+273.16 when windSpeedKt <= 4.8', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 2) // 2 m/s -> 3.704 kt <= 4.8
    // tempC = -4.99 (rounding), fallback = tempC + 273.16 ≈ 268.15
    out[0].value.should.be.closeTo(268.15, 1e-6)
  })

  it('falls back to tempC+273.16 when tempC > 10', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(288.15, 6) // 15°C, 6 m/s -> tempC > 10
    out[0].value.should.be.closeTo(288.15, 1e-6)
  })
})
