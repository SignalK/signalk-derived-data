const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('tankVolume2', () => {
  const calc = require('../calcs/tankVolume2')

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
})
