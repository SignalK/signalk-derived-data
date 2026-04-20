import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('leewayAngle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/leewayAngle')

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

  it('returns the signed, circularly-normalised cog - hdg difference', () => {
    const d = calc(makeApp(), makePlugin())
    // hdg = 0.1 rad, cog = 0.2 rad -> track is 0.1 rad starboard of
    // heading, so leeway is +0.1 rad (to starboard).
    const out = d.calculator(0.1, 0.2)
    out[0].path.should.equal('navigation.leewayAngle')
    out[0].value.should.be.closeTo(0.1, 1e-9)
  })

  it('normalises across the 0/2*PI wrap', () => {
    const d = calc(makeApp(), makePlugin())
    // hdg just past the wrap, cog just before it: track is 0.1 rad
    // port of heading, so leeway is -0.1 rad.
    const out = d.calculator(0.05, 2 * Math.PI - 0.05)
    out[0].value.should.be.closeTo(-0.1, 1e-6)
  })

  it('preserves the sign (positive = leeway to starboard)', () => {
    const d = calc(makeApp(), makePlugin())
    // cog > hdg -> track is to starboard of heading -> positive.
    const out = d.calculator(0.1, 0.3)
    out[0].value.should.be.closeTo(0.2, 1e-9)
  })

  it('clamps to +30 degrees when the delta exceeds the limit', () => {
    const d = calc(makeApp(), makePlugin())
    // Half-turn delta: circular normalisation yields PI, far larger
    // than any physical leeway. Expect the +30 degree limit.
    const out = d.calculator(0, Math.PI - 0.01)
    out[0].value.should.be.closeTo(Math.PI / 6, 1e-9)
  })

  it('clamps to -30 degrees when the delta is below the negative limit', () => {
    const d = calc(makeApp(), makePlugin())
    // Large port-ward delta clamps at the negative limit.
    const out = d.calculator(Math.PI / 2, 0)
    out[0].value.should.be.closeTo(-Math.PI / 6, 1e-9)
  })
})
