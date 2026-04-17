const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('headingTrue (extra branches)', () => {
  const calc = require('../calcs/headingTrue')

  it('falls back to getSelfPath when magneticVariation is the 9999 sentinel', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5, 9999)
    out[0].value.should.be.closeTo(0.6, 1e-9)
  })

  it('returns undefined when the fallback also yields null', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: null } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(0.5, 9999)).to.equal(undefined)
  })

  it('wraps negative results into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, -0.2)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('wraps results above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, 0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})
