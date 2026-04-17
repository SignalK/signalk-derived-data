const chai = require('chai')
chai.Should()
const expect = chai.expect

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

  it('computes moist-air density for 25°C, 50% RH, 1013.25 hPa', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(298.15, 0.5, 101325)
    out.should.be.an('array').with.lengthOf(1)
    out[0].path.should.equal('environment.outside.airDensity')
    // Textbook reference: moist air at 25°C, 50% RH, 1013.25 hPa is
    // ≈ 1.177 kg/m³. Tetens saturation pressure plus the ideal-gas
    // mixture formula from the Wikipedia article linked in the source.
    out[0].value.should.be.closeTo(1.177, 1e-3)
  })

  it('computes dry-air density for 0% RH', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(288.15, 0, 101325)
    // ISA dry air at 15°C, 1013.25 hPa = 1.225 kg/m³
    out[0].value.should.be.closeTo(1.225, 1e-3)
  })

  it('returns undefined when any input is non-finite', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(NaN, 0.5, 101325)).to.equal(undefined)
    expect(d.calculator(298.15, null, 101325)).to.equal(undefined)
    expect(d.calculator(298.15, 0.5, undefined)).to.equal(undefined)
    expect(d.calculator(Infinity, 0.5, 101325)).to.equal(undefined)
  })

  it('returns undefined when temperature is at or below absolute zero', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(0, 0.5, 101325)).to.equal(undefined)
    expect(d.calculator(-10, 0.5, 101325)).to.equal(undefined)
  })
})
