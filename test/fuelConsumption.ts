import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('fuelConsumption', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/fuelConsumption')

  it('produces one descriptor per configured engine', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0].group.should.equal('propulsion')
    arr[0].optionKey.should.equal('economyport')
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'propulsion.port.fuel.rate',
        'navigation.speedOverGround'
      ])
  })

  it('computes economy = speed / rate for valid inputs', () => {
    const arr = calc(makeApp(), makePlugin())
    arr[0]
      .calculator(2, 10)
      .should.deep.equal([{ path: 'propulsion.port.fuel.economy', value: 5 }])
  })

  it('returns undefined when fuel rate is zero or non-finite', () => {
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(0, 10)).to.equal(undefined)
    expect(arr[0].calculator(null, 10)).to.equal(undefined)
    expect(arr[0].calculator(undefined, 10)).to.equal(undefined)
    expect(arr[0].calculator(NaN, 10)).to.equal(undefined)
  })

  it('returns undefined when fuel rate is negative', () => {
    // An injector can't un-burn fuel; a negative rate is a sensor
    // glitch, not a legitimate reading.
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(-0.5, 10)).to.equal(undefined)
  })

  it('returns undefined when speed is non-finite', () => {
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(2, null)).to.equal(undefined)
    expect(arr[0].calculator(2, undefined)).to.equal(undefined)
  })

  it('returns undefined when speed is negative', () => {
    // SOG is a magnitude per SignalK convention; a negative value is
    // a sensor glitch rather than astern movement.
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(2, -1)).to.equal(undefined)
  })
})
