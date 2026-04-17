const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('fuelConsumtion', () => {
  const calc = require('../calcs/fuelConsumtion')

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

  it('returns undefined when speed is non-finite', () => {
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(2, null)).to.equal(undefined)
    expect(arr[0].calculator(2, undefined)).to.equal(undefined)
  })
})
