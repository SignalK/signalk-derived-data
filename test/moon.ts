import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('moon (covers the calculator path with valid inputs)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/moon')

  // The moon tests pin exact suncalc outputs for one reference date so
  // that arithmetic, rounding, and phase-name drift all get caught.
  // 2024-06-21T12:00Z @ 10N 20E was chosen because both moon-rise and
  // moon-set fall within the day, exercising both of those fields.
  it('returns exact phase/times for a known datetime + position', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 10,
      longitude: 20
    })
    const byPath: Record<string, any> = Object.fromEntries(
      out.map((x: any) => [x.path, x.value])
    )
    byPath['environment.moon.fraction'].should.be.closeTo(0.99, 1e-9)
    byPath['environment.moon.phase'].should.be.closeTo(0.47, 1e-9)
    byPath['environment.moon.phaseName'].should.equal('Waxing Gibbous')
    byPath['environment.moon.angle'].should.be.closeTo(-2.1, 1e-9)
    byPath['environment.moon.times.rise'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.set'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.alwaysUp'].should.equal(false)
    byPath['environment.moon.times.alwaysDown'].should.equal(false)
  })

  it('classifies the four phase buckets that real suncalc outputs reach', () => {
    // suncalc returns floats in [0, 1); hitting phase == 0 / 0.25 /
    // 0.5 / 0.75 exactly requires crafted synthetic data. The four
    // non-equality bucket names are reachable with real dates.
    const d = calc(makeApp(), makePlugin())
    const dates: Record<string, string> = {
      'Waxing Crescent': '2024-06-07T00:00:00Z',
      'Waxing Gibbous': '2024-06-17T00:00:00Z',
      'Waning Gibbous': '2024-06-23T00:00:00Z',
      'Waning Crescent': '2024-06-30T00:00:00Z'
    }
    for (const [expected, ts] of Object.entries(dates)) {
      const out = d.calculator(ts, { latitude: 0, longitude: 0 })
      const name = out.find(
        (x: any) => x.path === 'environment.moon.phaseName'
      ).value
      name.should.equal(expected)
    }
  })

  it('honours forecastDays > 0 by emitting prefixed forecast paths with the expected phases', () => {
    const plugin = makePlugin({ moon: { forecastDays: 2 } })
    const d = calc(makeApp(), plugin)
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 10,
      longitude: 20
    })
    const byPath: Record<string, any> = Object.fromEntries(
      out.map((x: any) => [x.path, x.value])
    )
    byPath['environment.moon.1.phase'].should.be.closeTo(0.52, 1e-9)
    byPath['environment.moon.2.phase'].should.be.closeTo(0.55, 1e-9)
    byPath['environment.moon.1.phaseName'].should.equal('Waning Gibbous')
    byPath['environment.moon.2.phaseName'].should.equal('Waning Gibbous')
  })

  it('uses the current time when datetime is undefined', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(undefined, { latitude: 0, longitude: 0 })
    out.length.should.be.greaterThan(0)
    const phaseName = out.find(
      (x: any) => x.path === 'environment.moon.phaseName'
    )
    phaseName.value.should.be.a('string')
    ;[
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent'
    ].should.include(phaseName.value)
  })

  // suncalc.getMoonIllumination returns phase as a float in [0, 1), and
  // in practice it is essentially never exactly 0, 0.25, 0.5, or 0.75
  // at the instant of a real date input. The phase-name switch in moon.js
  // has dedicated `phase == X` cases for those four fixed points,
  // matching how astronomers label the cardinal phases. Stubbing suncalc
  // is the only way to hit them with deterministic inputs.
  it('names the four cardinal phases when suncalc returns exact equality', () => {
    const suncalcPath = require.resolve('suncalc')
    const moonPath = require.resolve('../src/calcs/moon')
    const realSuncalc = require.cache[suncalcPath]
    const realMoon = require.cache[moonPath]

    function stubWithPhase(phase: number, times?: any): any {
      require.cache[suncalcPath] = {
        id: suncalcPath,
        filename: suncalcPath,
        loaded: true,
        exports: {
          getMoonIllumination: () => ({ phase, fraction: 0.5, angle: 0 }),
          getMoonTimes: () =>
            times || {
              rise: new Date(),
              set: new Date(),
              alwaysUp: false,
              alwaysDown: false
            }
        }
      } as NodeJS.Module
      delete require.cache[moonPath]
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../src/calcs/moon')
    }

    try {
      const cases: Array<[number, string]> = [
        [0, 'New Moon'],
        [0.25, 'First Quarter'],
        [0.5, 'Full Moon'],
        [0.75, 'Last Quarter']
      ]
      for (const [phase, expectedName] of cases) {
        const moonCalc = stubWithPhase(phase)
        const d = moonCalc(makeApp(), makePlugin())
        const out = d.calculator('2024-06-21T12:00:00Z', {
          latitude: 10,
          longitude: 20
        })
        const name = out.find(
          (x: any) => x.path === 'environment.moon.phaseName'
        )
        name.value.should.equal(expectedName)
      }

      // times.rise / times.set are falsy when the moon neither rises nor
      // sets on a given day — the `|| null` fallbacks in moon.js emit
      // null for both. Latitudes above the polar circles during winter
      // produce this naturally; stubbing is the surest way to hit it.
      const polarMoon = stubWithPhase(0.1, {
        alwaysUp: false,
        alwaysDown: true
      })
      const polar = polarMoon(makeApp(), makePlugin()).calculator(
        '2024-12-21T12:00:00Z',
        { latitude: 80, longitude: 0 }
      )
      const rise = polar.find(
        (x: any) => x.path === 'environment.moon.times.rise'
      )
      const setT = polar.find(
        (x: any) => x.path === 'environment.moon.times.set'
      )
      expect(rise.value).to.equal(null)
      expect(setT.value).to.equal(null)
    } finally {
      if (realSuncalc) require.cache[suncalcPath] = realSuncalc
      else delete require.cache[suncalcPath]
      if (realMoon) require.cache[moonPath] = realMoon
      else delete require.cache[moonPath]
    }
  })
})
