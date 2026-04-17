const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('leewayAngle', () => {
  const calc = require('../calcs/leewayAngle')

  it('returns null when either input is non-finite', () => {
    const d = calc(makeApp(), makePlugin())
    d.calculator(NaN, 0.2).should.deep.equal([
      { path: 'navigation.leewayAngle', value: null }
    ])
    d.calculator(0.1, Infinity).should.deep.equal([
      { path: 'navigation.leewayAngle', value: null }
    ])
    d.calculator(null, 0.2).should.deep.equal([
      { path: 'navigation.leewayAngle', value: null }
    ])
  })

  it('returns the signed, circularly-normalised hdg - cog difference', () => {
    const d = calc(makeApp(), makePlugin())
    // hdg = 0.1 rad, cog = 0.2 rad -> heading is 0.1 rad port of cog.
    // Expect a small negative value (port = negative starboard leeway).
    const out = d.calculator(0.1, 0.2)
    out[0].path.should.equal('navigation.leewayAngle')
    out[0].value.should.be.closeTo(-0.1, 1e-9)
  })

  it('normalises across the 0/2*PI wrap', () => {
    const d = calc(makeApp(), makePlugin())
    // hdg just past the wrap, cog just before it: true difference is small.
    const out = d.calculator(0.05, 2 * Math.PI - 0.05)
    out[0].value.should.be.closeTo(0.1, 1e-6)
  })

  it('preserves the sign (positive = leeway to starboard)', () => {
    const d = calc(makeApp(), makePlugin())
    // hdg > cog -> heading is to starboard of track -> positive.
    const out = d.calculator(0.3, 0.1)
    out[0].value.should.be.closeTo(0.2, 1e-9)
  })
})
