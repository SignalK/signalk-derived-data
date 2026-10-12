import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('suntime', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/suntime')

  // USNO one-day service, Bellingham, 2026-03-20. Its times are rounded to minutes.
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-03-20&coords=48.7621,-123.052&tz=0
  it('matches USNO rise, transit and dawn within one minute', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2026-03-20T20:00Z', {
      latitude: 48.7621,
      longitude: -123.052
    })
    const times = Object.fromEntries(
      out.map((x: any) => [x.path.split('.').pop(), x.value])
    )
    for (const [name, expected] of [
      ['sunrise', '2026-03-20T14:15Z'],
      ['solarNoon', '2026-03-20T20:20Z'],
      ['dawn', '2026-03-20T13:43Z']
    ]) {
      times[name!].getTime().should.be.closeTo(Date.parse(expected!), 60000)
    }
    times.sunriseEnd.getTime().should.be.greaterThan(times.sunrise.getTime())
    times.goldenHourEnd
      .getTime()
      .should.be.greaterThan(times.sunriseEnd.getTime())
    times.goldenHour.getTime().should.be.lessThan(times.sunsetStart.getTime())
    times.sunsetStart.getTime().should.be.lessThan(times.sunset.getTime())
    times.nadir.getTime().should.be.lessThan(times.solarNoon.getTime())
  })

  it('uses current time when datetime is empty and still emits the full set', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.length.should.equal(14)
    out
      .every((x: any) => x.path.startsWith('environment.sunlight.times'))
      .should.equal(true)
  })

  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-05-14&coords=70.5,-123.052&tz=0
  it('finds the grazing Arctic sunrise before the midnight sun season', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2026-05-14T20:00Z', {
      latitude: 70.5,
      longitude: -123.052
    })
    const sunrise = out.find(
      (x: any) => x.path === 'environment.sunlight.times.sunrise'
    ).value
    sunrise.getTime().should.be.closeTo(Date.parse('2026-05-14T08:16Z'), 60000)
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
    // pins the arithmetic without hardcoding the exact event times.
    ;(d1 - d0).should.be.closeTo(86400000, 120000)
    ;(d2 - d1).should.be.closeTo(86400000, 120000)
  })
})
