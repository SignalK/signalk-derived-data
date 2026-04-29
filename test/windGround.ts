import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('windGround (extra branches)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calcs: any = require('../src/calcs/windGround')

  it('computes the expected values for a finite input vector', () => {
    const arr = calcs(makeApp(), makePlugin())
    const ground = arr[0]
    const out = ground.calculator(1.0, 3.0, 5.0, 0.5)
    out.should.have.lengthOf(3)
    out[0].path.should.equal('environment.wind.directionGround')
    out[1].path.should.equal('environment.wind.angleTrueGround')
    out[2].path.should.equal('environment.wind.speedOverGround')
    out[0].value.should.be.closeTo(2.0459686742419585, 1e-9)
    out[1].value.should.be.closeTo(1.0459686742419587, 1e-9)
    out[2].value.should.be.closeTo(2.769931974487608, 1e-9)
  })

  it('uses awa as the angle when aws is effectively zero', () => {
    const arr = calcs(makeApp(), makePlugin())
    const ground = arr[0]
    const out = ground.calculator(1.0, 3.0, 1e-12, 0.5)
    out[1].value.should.be.closeTo(0.5, 1e-9)
  })

  it('deprecated calc returns null path when inputs are non-finite', () => {
    const arr = calcs(makeApp(), makePlugin())
    const deprecated = arr[1]
    const out = deprecated.calculator(null, 0.1)
    out.should.deep.equal([
      { path: 'environment.wind.directionGround', value: null }
    ])
  })

  it('deprecated calc returns a wrapped compass angle for finite inputs', () => {
    const arr = calcs(makeApp(), makePlugin())
    const deprecated = arr[1]
    const out = deprecated.calculator(2, 1)
    out[0].value.should.be.closeTo(3, 1e-9)
  })
})
