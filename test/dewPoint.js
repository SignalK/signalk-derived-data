const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('dewPoint', () => {
  const calc = require('../calcs/dewPoint')

  it('exposes one descriptor per configured air area', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'environment.outside.temperature',
        'environment.outside.humidity'
      ])
  })
})
