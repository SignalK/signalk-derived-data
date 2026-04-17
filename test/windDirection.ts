import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('windDirection (extra null branches)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calcs: any = require('../src/calcs/windDirection')

  it('guards null in the angleTrueWater calculator', () => {
    const arr = calcs(makeApp(), makePlugin())
    const angleTrueWater = arr.find(
      (c: any) => c.optionKey === 'angleTrueWater'
    )
    const out = angleTrueWater.calculator(null, null, null)
    out.should.deep.equal([
      { path: 'environment.wind.angleTrueWater', value: null },
      { path: 'environment.wind.speedTrue', value: null }
    ])
  })

  it('falls back to awa when aws is essentially zero', () => {
    const arr = calcs(makeApp(), makePlugin())
    const angleTrueWater = arr.find(
      (c: any) => c.optionKey === 'angleTrueWater'
    )
    const out = angleTrueWater.calculator(3, 1e-12, 0.7)
    out[0].value.should.be.closeTo(0.7, 1e-6)
  })
})
