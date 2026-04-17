import * as chai from 'chai'
chai.should()
const expect = chai.expect

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tankVolume: any = require('../src/calcs/tankVolume')

// tankVolume's calculator reads `plugin.properties.tanks` via closure
// at call time, so the tests build a plugin with calibration data up
// front and pass it into the factory. The existing `calc.tests` harness
// in test/test.js doesn't support per-test plugin properties, which is
// why this suite is standalone.
function makePlugin(
  instance: string,
  volumeUnit: string,
  calibration: Array<{ level: number; volume: number }>
): any {
  return {
    tanks: [instance],
    properties: {
      tanks: {
        volume_unit: volumeUnit,
        ['calibrations.' + instance]: calibration
      }
    }
  }
}

const app: any = { debug: () => {} }

describe('tankVolume', () => {
  // Calibration expressed as (level ratio 0..1, volume in the selected unit).
  // For a linear tank, volume scales linearly with level, so the spline
  // should exactly reproduce the calibration pairs at the knot points
  // and interpolate smoothly in between.
  const linearCalLitres = [
    { level: 0, volume: 0 },
    { level: 0.25, volume: 25 },
    { level: 0.5, volume: 50 },
    { level: 0.75, volume: 75 },
    { level: 1, volume: 100 }
  ]

  it('produces capacity and currentVolume paths for the configured instance', () => {
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]

    const result = calc.calculator(0.5)

    result.should.be.an('array').with.lengthOf(2)
    result[0].path.should.equal('tanks.fuel.0.capacity')
    result[1].path.should.equal('tanks.fuel.0.currentVolume')
  })

  it('reports capacity as the volume at level = 1', () => {
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]

    // 100 L expressed in m^3 = 0.1
    const result = calc.calculator(0)
    result[0].value.should.be.closeTo(0.1, 1e-9)
  })

  it('interpolates currentVolume at exact knot points', () => {
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]

    // 50 L at level 0.5 -> 0.05 m^3
    const result = calc.calculator(0.5)
    result[1].value.should.be.closeTo(0.05, 1e-9)
  })

  it('interpolates currentVolume between knot points', () => {
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]

    // Linear calibration -> level 0.375 should be ~37.5 L = 0.0375 m^3.
    // Cubic spline may deviate slightly but should be within a few mL.
    const result = calc.calculator(0.375)
    result[1].value.should.be.closeTo(0.0375, 1e-3)
  })

  it('converts gallons to cubic metres', () => {
    const gallonsCal = [
      { level: 0, volume: 0 },
      { level: 0.5, volume: 10 },
      { level: 1, volume: 20 }
    ]
    const plugin = makePlugin('fuel.0', 'gal', gallonsCal)
    const calc = tankVolume(app, plugin)[0]

    // 20 gal * 0.00378541 m^3/gal = 0.0757082 m^3 at level = 1
    const result = calc.calculator(1)
    result[0].value.should.be.closeTo(0.0757082, 1e-6)
    result[1].value.should.be.closeTo(0.0757082, 1e-6)
  })

  it('leaves m^3 calibration values unconverted', () => {
    const m3Cal = [
      { level: 0, volume: 0 },
      { level: 0.5, volume: 0.125 },
      { level: 1, volume: 0.25 }
    ]
    const plugin = makePlugin('fuel.0', 'm3', m3Cal)
    const calc = tankVolume(app, plugin)[0]

    const result = calc.calculator(1)
    result[0].value.should.be.closeTo(0.25, 1e-9)
  })

  it('uses the calculator API (regression for cubic-spline v2+ API)', () => {
    // cubic-spline 2.x removed the `spline(x, xs, ys)` function form
    // in favour of `new Spline(xs, ys).at(x)`. A calculator call must
    // not throw under the new API.
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]

    expect(() => calc.calculator(0.5)).to.not.throw()
  })

  it('returns a constant capacity across repeated calculator calls', () => {
    // Per-tick caching means capacity is computed once; successive calls
    // at different levels must still report the same capacity value.
    const plugin = makePlugin('fuel.0', 'litres', linearCalLitres)
    const calc = tankVolume(app, plugin)[0]
    const a = calc.calculator(0.1)
    const b = calc.calculator(0.9)
    a[0].value.should.equal(b[0].value)
  })

  it('falls back to the m^3 factor for an unknown volume unit', () => {
    // Matches the pre-refactor `else` branch: any unit we don't recognise
    // is treated as already-in-m^3 so configured calibration values are
    // passed through unchanged.
    const cal = [
      { level: 0, volume: 0 },
      { level: 1, volume: 0.25 }
    ]
    const plugin = makePlugin('fuel.0', 'hogsheads', cal)
    const calc = tankVolume(app, plugin)[0]

    const result = calc.calculator(1)
    result[0].value.should.be.closeTo(0.25, 1e-9)
  })
})
