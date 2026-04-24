import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('tankVolume2', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/tankVolume2')

  it('exposes derivedFrom for the configured tank', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0]
      .derivedFrom()
      .should.deep.equal(['tanks.fuel.0.currentLevel', 'tanks.fuel.0.capacity'])
    arr[0].optionKey.should.equal('tankVolume2_fuel.0')
  })

  it('computes currentVolume = level * capacity', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(0.5, 0.1)
    out.should.deep.equal([{ path: 'tanks.fuel.0.currentVolume', value: 0.05 }])
  })

  it('returns undefined when level is non-finite', () => {
    // Upstream sensor NaN would otherwise propagate as NaN * capacity
    // and surface in the server log.
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(NaN, 0.1)).to.be.undefined
    expect(arr[0].calculator(undefined as unknown as number, 0.1)).to.be
      .undefined
  })

  it('returns undefined when capacity is non-finite', () => {
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(0.5, NaN)).to.be.undefined
    expect(arr[0].calculator(0.5, undefined as unknown as number)).to.be
      .undefined
  })
})
