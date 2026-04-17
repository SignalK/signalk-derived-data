const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('moon (covers the calculator path with valid inputs)', () => {
  const calc = require('../calcs/moon')

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
    const byPath = Object.fromEntries(out.map((x) => [x.path, x.value]))
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
    const dates = {
      'Waxing Crescent': '2024-06-07T00:00:00Z',
      'Waxing Gibbous': '2024-06-17T00:00:00Z',
      'Waning Gibbous': '2024-06-23T00:00:00Z',
      'Waning Crescent': '2024-06-30T00:00:00Z'
    }
    for (const [expected, ts] of Object.entries(dates)) {
      const out = d.calculator(ts, { latitude: 0, longitude: 0 })
      const name = out.find(
        (x) => x.path === 'environment.moon.phaseName'
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
    const byPath = Object.fromEntries(out.map((x) => [x.path, x.value]))
    byPath['environment.moon.1.phase'].should.be.closeTo(0.52, 1e-9)
    byPath['environment.moon.2.phase'].should.be.closeTo(0.55, 1e-9)
    byPath['environment.moon.1.phaseName'].should.equal('Waning Gibbous')
    byPath['environment.moon.2.phaseName'].should.equal('Waning Gibbous')
  })

  it('uses the current time when datetime is undefined', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(undefined, { latitude: 0, longitude: 0 })
    out.length.should.be.greaterThan(0)
    const phaseName = out.find((x) => x.path === 'environment.moon.phaseName')
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
})
