import { expect } from 'chai'
import { makeApp, makePlugin } from './helpers'

describe('celestial positions', () => {
  it('emits Sun, Moon and the five naked-eye planets in radians', () => {
    const calc = require('../src/calcs/celestial')(makeApp(), makePlugin())
    const out = calc.calculator('2024-01-01T12:00Z', {
      latitude: 10,
      longitude: 20
    })
    const values = Object.fromEntries(out.map((x: any) => [x.path, x.value]))
    expect(out).to.have.length(14)
    expect(values['environment.sunlight.azimuth']).to.be.closeTo(3.655, 0.001)
    expect(values['environment.sunlight.altitude']).to.be.closeTo(0.908, 0.001)
    expect(values['environment.moon.azimuth']).to.be.closeTo(5.12, 0.001)
    expect(values['environment.moon.altitude']).to.be.closeTo(-0.738, 0.001)
    expect(values['environment.planets.venus.azimuth']).to.be.closeTo(
      4.251,
      0.001
    )
    expect(values['environment.planets.venus.altitude']).to.be.closeTo(
      0.437,
      0.001
    )
    for (const body of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
      expect(values[`environment.planets.${body}.azimuth`]).to.be.within(
        0,
        2 * Math.PI
      )
      expect(values[`environment.planets.${body}.altitude`]).to.be.within(
        -Math.PI / 2,
        Math.PI / 2
      )
    }
  })

  it('skips invalid positions and dates without throwing', () => {
    const calc = require('../src/calcs/celestial')(makeApp(), makePlugin())
    expect(calc.calculator('2024-01-01T12:00Z', null)).to.equal(undefined)
    expect(
      calc.calculator('invalid', { latitude: 10, longitude: 20 })
    ).to.equal(undefined)
    expect(
      calc.calculator('2101-01-01T00:00Z', { latitude: 10, longitude: 20 })
    ).to.equal(undefined)
  })

  it('registers radian metadata once when enabled and handles registration errors', async () => {
    const metadata: Array<{ path: string; units: string }> = []
    const errors: unknown[] = []
    const app = makeApp({
      setDefaultMetadata: async (path: string, value: { units: string }) => {
        metadata.push({ path, units: value.units })
        throw new Error('metadata unavailable')
      },
      error: (error: unknown) => errors.push(error)
    })
    const calc = require('../src/calcs/celestial')(app, makePlugin())
    expect(metadata).to.have.length(0)
    calc.calculator('2024-01-01T12:00Z', { latitude: 10, longitude: 20 })
    calc.calculator('2024-01-01T12:01Z', { latitude: 10, longitude: 20 })
    await Promise.resolve()
    expect(metadata).to.have.length(14)
    expect(metadata).to.include.deep.members([
      { path: 'environment.sunlight.azimuth', units: 'rad' },
      { path: 'environment.planets.venus.altitude', units: 'rad' }
    ])
    expect(errors).to.have.length(14)
  })
})
