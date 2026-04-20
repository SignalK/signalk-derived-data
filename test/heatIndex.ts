import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('heatIndex', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/heatIndex')

  const d = () => calc(makeApp(), makePlugin())

  it('applies the Rothfusz regression at 95°F, 70% RH', () => {
    const out = d().calculator(308.15, 0.7)
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
    out[0].value.should.be.closeTo(323.4905780555556, 1e-9)
  })

  // 290 K = ~62 F, 50% RH. avg(simple, T) = 61.5 F, well below 80, so
  // canonical NWS returns the simple Steadman value (60.613 F) rather
  // than the raw temperature. Difference vs raw: ~1 K cooler.
  it('returns the simple Steadman value below the canonical threshold', () => {
    const out = d().calculator(290, 0.5)
    out[0].value.should.be.closeTo(289.0461111111111, 1e-9)
  })

  // T=79 F, RH=100% is the canonical case where T < 80 F but the
  // "feels like" temperature exceeds 80 F. avg(simple, T) = 80.15,
  // so Rothfusz runs. A `T >= 80` guard would miss this.
  it('applies Rothfusz for T<80°F when humidity pushes avg >= 80°F', () => {
    const out = d().calculator(((79 - 32) * 5) / 9 + 273.15, 1.0)
    // At tempF=79 the inner "80..112 low-humidity" and "80..87 high-humidity"
    // adjustments do not fire, so only the raw Rothfusz output contributes.
    out[0].value.should.be.closeTo(301.92807118888896, 1e-9)
  })

  it('applies the high-humidity adjustment for 80-87°F and RH > 85%', () => {
    // 85°F, 90% RH -> triggers the `h > 85 && tempF <= 87` branch.
    const out = d().calculator(((85 - 32) * 5) / 9 + 273.15, 0.9)
    out[0].value.should.be.closeTo(311.91711311111135, 1e-9)
  })

  it('applies the low-humidity adjustment for 80-112°F and RH < 13%', () => {
    // 100°F, 10% RH -> triggers the `h < 13 && tempF <= 112` branch.
    const out = d().calculator(((100 - 32) * 5) / 9 + 273.15, 0.1)
    out[0].value.should.be.closeTo(307.6624903678819, 1e-9)
  })

  // tempF = 80, h = 40%: canonical avg(simple, T) = 79.79 is below
  // the threshold, so the simple Steadman value is returned directly.
  it('returns the simple Steadman value when avg(simple, T) < 80°F', () => {
    const out = d().calculator(299.8167, 0.4) // ~80°F, 40% RH
    out[0].value.should.be.closeTo(299.58337, 1e-3)
  })

  it('returns undefined when any input is non-finite', () => {
    const out1 = d().calculator(NaN, 0.5)
    expect(out1).to.equal(undefined)
    const out2 = d().calculator(298.15, null)
    expect(out2).to.equal(undefined)
    const out3 = d().calculator(Infinity, 0.5)
    expect(out3).to.equal(undefined)
  })

  it('returns undefined when temperature is at or below absolute zero', () => {
    expect(d().calculator(0, 0.5)).to.equal(undefined)
    expect(d().calculator(-10, 0.5)).to.equal(undefined)
  })
})
