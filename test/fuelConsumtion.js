// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

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

  // BUG: the calculator divides speed by rate with no guard for rate
  // being zero or missing, producing Infinity / -Infinity.
  it('returns speed / rate without a divide-by-zero guard', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(2, 10)
    out.should.deep.equal([{ path: 'propulsion.port.fuel.economy', value: 5 }])
    const div0 = arr[0].calculator(0, 10)
    div0[0].value.should.equal(Infinity)
  })
})
