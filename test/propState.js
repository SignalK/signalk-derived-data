const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('propState', () => {
  const calc = require('../calcs/propState')

  it('defaults currentState to "none" when not in selfData', () => {
    const arr = calc(makeApp(), makePlugin())
    // state missing -> 'none'; revol=0 -> !== 'stopped' -> emit 'stopped'
    const out = arr[0].calculator(0)
    out.should.deep.equal([{ path: 'propulsion.port.state', value: 'stopped' }])
  })
})
