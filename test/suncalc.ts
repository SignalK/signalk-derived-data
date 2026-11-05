import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('suncalc (night fallback)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/suncalc')

  it('returns "night" when now is before nauticalDawn', () => {
    const d = calc(makeApp(), makePlugin())
    // Summer solstice, equator: nauticalDawn ~05:10Z. 02:00Z is earlier.
    const out = d.calculator('2024-06-21T02:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    out.should.deep.equal([
      { path: 'environment.sun', value: 'night' },
      { path: 'environment.mode', value: 'night' }
    ])
  })

  it('uses the current time when datetime is empty and position is valid', () => {
    const d = calc(makeApp(), makePlugin())
    // Valid position, empty datetime -> `new Date()` path is taken. The
    // assertion only checks the shape; the exact value depends on the
    // current clock.
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.should.be.an('array').with.lengthOf(2)
    out[0].path.should.equal('environment.sun')
  })
})

describe('suncalc branches', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/suncalc')
  const equator = { latitude: 0, longitude: 0 }

  // 2024-06-21 at 0,0 (UTC, suncalc v2):
  //   nauticalDawn 05:09 | dawn 05:35 | sunrise 05:58 | sunriseEnd 06:00
  //   sunsetStart 18:03 | sunset 18:05 | dusk 18:28 | nauticalDusk 18:54 | night 19:20
  const cases: Array<[string, string, string]> = [
    ['2024-06-21T06:00:00Z', 'sunrise', 'day'],
    ['2024-06-21T12:00:00Z', 'day', 'day'],
    ['2024-06-21T18:15:00Z', 'sunset', 'night'],
    ['2024-06-21T18:40:00Z', 'dusk', 'night'],
    ['2024-06-21T19:00:00Z', 'nauticalDusk', 'night'],
    ['2024-06-21T20:00:00Z', 'night', 'night'],
    // Regression coverage for the dawn / nauticalDawn ordering bug: with the
    // buggy ordering, 05:45Z would be reported as 'nauticalDawn'.
    ['2024-06-21T05:45:00Z', 'dawn', 'night'],
    ['2024-06-21T05:20:00Z', 'nauticalDawn', 'night'],
    ['2024-06-21T03:00:00Z', 'night', 'night']
  ]

  cases.forEach(([datetime, sun, mode]) => {
    it(`reports ${sun} / ${mode} at ${datetime}`, () => {
      const d = calc(makeApp(), makePlugin())
      d.calculator(datetime, equator).should.deep.equal([
        { path: 'environment.sun', value: sun },
        { path: 'environment.mode', value: mode }
      ])
    })
  })
})

describe('suncalc publishes environment.mode only on a change', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/suncalc')
  const equator = { latitude: 0, longitude: 0 }

  it('leaves the mode out while it stays the same', () => {
    // A day/night switch made by hand must hold until sunrise or sunset.
    const d = calc(makeApp(), makePlugin())
    d.calculator('2024-06-21T12:00:00Z', equator)
    d.calculator('2024-06-21T12:01:00Z', equator).should.deep.equal([
      { path: 'environment.sun', value: 'day' }
    ])
  })

  it('publishes the mode again when the sun sets and rises', () => {
    const d = calc(makeApp(), makePlugin())
    d.calculator('2024-06-21T12:00:00Z', equator)
    d.calculator('2024-06-21T18:15:00Z', equator).should.deep.equal([
      { path: 'environment.sun', value: 'sunset' },
      { path: 'environment.mode', value: 'night' }
    ])
    d.calculator('2024-06-21T20:00:00Z', equator).should.deep.equal([
      { path: 'environment.sun', value: 'night' }
    ])
    d.calculator('2024-06-22T06:00:00Z', equator).should.deep.equal([
      { path: 'environment.sun', value: 'sunrise' },
      { path: 'environment.mode', value: 'day' }
    ])
  })
})
