import { expect } from 'chai'
import { makeApp, makePlugin } from './helpers'

describe('astronomy input and forecast contract', () => {
  for (const name of ['moon', 'suntime', 'suncalc']) {
    const factory = require(`../src/calcs/${name}`)

    it(`${name} skips invalid and unsupported dates`, () => {
      const calc = factory(makeApp(), makePlugin())
      for (const date of [
        'invalid',
        '1949-12-31T12:00Z',
        '2101-01-01T00:00Z'
      ]) {
        expect(calc.calculator(date, { latitude: 0, longitude: 0 })).to.equal(
          undefined
        )
      }
    })
  }

  for (const [name, count] of [
    ['moon', 8],
    ['suntime', 14]
  ] as const) {
    it(`${name} honours forecastDays zero`, () => {
      const calc = require(`../src/calcs/${name}`)(makeApp(), makePlugin())
      expect(
        calc.calculator('2024-06-21T12:00Z', { latitude: 0, longitude: 0 })
      ).to.have.length(count)
    })
  }

  it('reports polar daylight as day', () => {
    const calc = require('../src/calcs/suncalc')(makeApp(), makePlugin())
    expect(
      calc.calculator('2024-06-21T12:00Z', { latitude: 80, longitude: 0 })
    ).to.deep.equal([
      { path: 'environment.sun', value: 'day' },
      { path: 'environment.mode', value: 'day' }
    ])
  })

  it('keeps day mode until the Sun sets, including during sunset', () => {
    const calc = require('../src/calcs/suncalc')(makeApp(), makePlugin())
    for (const [date, mode] of [
      ['2024-06-21T18:04Z', 'day'],
      ['2024-06-21T18:06Z', 'night']
    ]) {
      expect(
        calc.calculator(date, { latitude: 0, longitude: 0 })
      ).to.deep.equal([
        { path: 'environment.sun', value: 'sunset' },
        { path: 'environment.mode', value: mode }
      ])
    }
  })

  it('keeps midnight sun in day mode even when the whole disc dips below the horizon', () => {
    const calc = require('../src/calcs/suncalc')(makeApp(), makePlugin())
    for (const latitude of [65.8, 66, 80]) {
      expect(
        calc.calculator('2024-06-21T00:10Z', { latitude, longitude: 0 })
      ).to.deep.equal([
        { path: 'environment.sun', value: 'day' },
        { path: 'environment.mode', value: 'day' }
      ])
    }
  })

  it('ends a short winter sunrise when the Sun never fully clears the horizon', () => {
    const calc = require('../src/calcs/suncalc')(makeApp(), makePlugin())
    for (const date of ['2024-12-21T13:00Z', '2024-12-21T14:30Z']) {
      expect(
        calc.calculator(date, { latitude: 67, longitude: 0 })
      ).to.deep.equal([
        { path: 'environment.sun', value: 'sunset' },
        { path: 'environment.mode', value: 'night' }
      ])
    }
  })

  it('keeps all sun paths and null crossings in polar night', () => {
    const calc = require('../src/calcs/suntime')(makeApp(), makePlugin())
    const out = calc.calculator('2024-12-21T12:00Z', {
      latitude: 80,
      longitude: 0
    })
    const times = Object.fromEntries(
      out.map((x: any) => [x.path.split('.').pop(), x.value])
    )
    expect(Object.keys(times)).to.have.length(14)
    expect(times.sunrise).to.equal(null)
    expect(times.sunset).to.equal(null)
    expect(times.solarNoon).to.be.instanceOf(Date)
    expect(times.nadir).to.be.instanceOf(Date)
  })

  it('keeps forecasts within the supported interval at both boundaries', () => {
    for (const name of ['moon', 'suntime']) {
      const calc = require(`../src/calcs/${name}`)(
        makeApp(),
        makePlugin({
          moon: { forecastDays: 10 },
          sun: { forecastDays: 10 }
        })
      )
      for (const date of ['1950-01-01T00:00Z', '2100-12-31T23:59Z']) {
        const out = calc.calculator(date, { latitude: 0, longitude: 179 })
        expect(out).to.be.an('array').and.not.be.empty
        for (const { value } of out) {
          if (value instanceof Date) {
            expect(value.getTime()).to.be.within(
              Date.parse('1950-01-01T00:00Z'),
              Date.parse('2101-01-01T00:00Z') - 1
            )
          }
        }
      }
    }
  })

  it('uses the nearest solar day on both sides of the dateline', () => {
    const calc = require('../src/calcs/suntime')(makeApp(), makePlugin())
    for (const [longitude, transit] of [
      [179, '2024-06-21T00:06Z'],
      [-179, '2024-06-20T23:58Z']
    ] as const) {
      const out = calc.calculator('2024-06-21T00:10Z', {
        latitude: 0,
        longitude
      })
      const times = Object.fromEntries(
        out.map((x: any) => [x.path.split('.').pop(), x.value])
      )
      expect(times.solarNoon.getTime()).to.be.closeTo(
        Date.parse(transit),
        60000
      )
      expect(times.sunrise.getTime()).to.be.lessThan(times.solarNoon.getTime())
      expect(times.sunset.getTime()).to.be.greaterThan(
        times.solarNoon.getTime()
      )
    }
  })
})
