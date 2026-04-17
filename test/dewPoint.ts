import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('dewPoint', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/dewPoint')

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
