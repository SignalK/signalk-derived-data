import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('moon (covers the calculator path with valid inputs)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/moon')

  // The moon tests pin rounded outputs for one reference date so
  // that arithmetic, rounding, and phase-name drift all get caught.
  // 2024-01-01T12:00Z @ 10N 20E is used because both moon-rise and
  // moon-set fall within the same UTC day, exercising both fields.
  it('returns exact phase/times for a known datetime + position', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-01-01T12:00:00Z', {
      latitude: 10,
      longitude: 20
    })
    const byPath: Record<string, any> = Object.fromEntries(
      out.map((x: any) => [x.path, x.value])
    )
    byPath['environment.moon.fraction'].should.be.closeTo(0.74, 1e-9)
    byPath['environment.moon.phase'].should.be.closeTo(0.67, 1e-9)
    byPath['environment.moon.phaseName'].should.equal('Waning Gibbous')
    byPath['environment.moon.angle'].should.be.closeTo(1.94, 1e-9)
    byPath['environment.moon.times.rise'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.set'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.alwaysUp'].should.equal(false)
    byPath['environment.moon.times.alwaysDown'].should.equal(false)
  })

  it('classifies the four phase buckets that real outputs reach', () => {
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

  it('names the cardinal phases with real dates after rounding', () => {
    const d = calc(makeApp(), makePlugin())
    for (const [ts, name] of [
      ['2024-06-06T13:00Z', 'New Moon'],
      ['2024-06-14T05:18Z', 'First Quarter'],
      ['2024-06-22T01:08Z', 'Full Moon'],
      ['2024-06-28T21:53Z', 'Last Quarter']
    ]) {
      const out = d.calculator(ts, { latitude: 0, longitude: 0 })
      expect(
        out.find((x: any) => x.path === 'environment.moon.phaseName').value
      ).to.equal(name)
    }
  })

  it('emits null rise/set and alwaysDown during a polar full moon', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-06-21T12:00Z', {
      latitude: 80,
      longitude: 0
    })
    const values = Object.fromEntries(out.map((x: any) => [x.path, x.value]))
    expect(values['environment.moon.times.rise']).to.equal(null)
    expect(values['environment.moon.times.set']).to.equal(null)
    expect(values['environment.moon.times.alwaysDown']).to.equal(true)
    expect(values['environment.moon.times.alwaysUp']).to.equal(false)
  })
})
