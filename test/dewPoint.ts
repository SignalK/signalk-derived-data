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

  it('reads relativeHumidity for inside air areas', () => {
    const plugin = makePlugin()
    plugin.air = ['outside', 'inside', 'inside.engineRoom']
    const arr = calc(makeApp(), plugin)
    arr
      .map((c: any) => c.derivedFrom())
      .should.deep.equal([
        ['environment.outside.temperature', 'environment.outside.humidity'],
        [
          'environment.inside.temperature',
          'environment.inside.relativeHumidity'
        ],
        [
          'environment.inside.engineRoom.temperature',
          'environment.inside.engineRoom.relativeHumidity'
        ]
      ])
  })
})
