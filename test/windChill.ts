import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('windChill', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/windChill')

  it('converts wind speed from m/s to km/h before applying the regression', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 5) // -5°C, 5 m/s -> 18 km/h
    out[0].path.should.equal('environment.outside.apparentWindChillTemperature')
    out[0].value.should.be.closeTo(261.9590667463045, 1e-9)
  })

  it('returns the raw temp when wind speed is under 4.8 km/h', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 1) // 1 m/s -> 3.6 km/h, below threshold
    out[0].value.should.be.closeTo(268.15, 1e-9)
  })

  it('returns the raw temp when tempC exceeds 10°C', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(288.15, 6) // 15°C, 6 m/s -> tempC > 10
    out[0].value.should.be.closeTo(288.15, 1e-9)
  })

  it('returns undefined when any input is non-finite', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(NaN, 5)).to.equal(undefined)
    expect(d.calculator(268.15, null)).to.equal(undefined)
    expect(d.calculator(Infinity, 5)).to.equal(undefined)
  })

  it('returns undefined when temperature is at or below absolute zero', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(0, 5)).to.equal(undefined)
    expect(d.calculator(-10, 5)).to.equal(undefined)
  })

  it('returns undefined when wind speed is negative', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(268.15, -1)).to.equal(undefined)
  })
})
