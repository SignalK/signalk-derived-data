import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('suntime', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/suntime')

  // Reference output at equator on 2024-06-21 (summer solstice) pinned
  // at sub-second precision so numeric-operator drift (+, -, *) inside
  // the date forecast arithmetic is detected.
  it('returns the exact rise/set times for a known date + position', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    const byPath: Record<string, any> = Object.fromEntries(
      out.map((x: any) => [
        x.path,
        x.value instanceof Date ? x.value.toISOString() : x.value
      ])
    )
    byPath['environment.sunlight.times.sunrise'].should.equal(
      '2024-06-21T05:59:28.185Z'
    )
    byPath['environment.sunlight.times.solarNoon'].should.equal(
      '2024-06-21T12:03:06.088Z'
    )
    byPath['environment.sunlight.times.sunset'].should.equal(
      '2024-06-21T18:06:43.990Z'
    )
    byPath['environment.sunlight.times.nauticalDawn'].should.equal(
      '2024-06-21T05:10:42.648Z'
    )
    byPath['environment.sunlight.times.dawn'].should.equal(
      '2024-06-21T05:36:56.029Z'
    )
    byPath['environment.sunlight.times.night'].should.equal(
      '2024-06-21T19:21:49.929Z'
    )
  })

  it('uses current time when datetime is empty and still emits the full set', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.length.should.be.greaterThan(14) // all fields on day 0 + the day-1 prefix set
    out
      .every((x: any) => x.path.startsWith('environment.sunlight.times'))
      .should.equal(true)
  })

  it('forecast day N is exactly N days after day 0', () => {
    const plugin = makePlugin({ sun: { forecastDays: 2 } })
    const d = calc(makeApp(), plugin)
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    const byPath: Record<string, any> = Object.fromEntries(
      out.map((x: any) => [x.path, x.value])
    )
    const d0 = byPath['environment.sunlight.times.sunrise'].getTime()
    const d1 = byPath['environment.sunlight.times.1.sunrise'].getTime()
    const d2 = byPath['environment.sunlight.times.2.sunrise'].getTime()
    // Solar day vs calendar day drift is small; a 24h ± 2min window
    // pins the arithmetic without hardcoding the exact suncalc values.
    ;(d1 - d0).should.be.closeTo(86400000, 120000)
    ;(d2 - d1).should.be.closeTo(86400000, 120000)
  })
})
