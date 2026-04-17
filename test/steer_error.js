const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('steer_error', () => {
  const calc = require('../calcs/steer_error')

  it('returns null steer when either input is non-finite', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(null, 1)
    out.should.deep.equal([
      {
        path: 'navigation.courseGreatCircle.nextPoint.steerError',
        value: null
      },
      {
        path: 'navigation.courseGreatCircle.nextPoint.leftSteerError',
        value: null
      },
      {
        path: 'navigation.courseGreatCircle.nextPoint.rightSteerError',
        value: null
      }
    ])
  })

  it('computes positive steer -> populated leftSteer, zero rightSteer', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(1.0, 0.5)
    out[0].value.should.be.closeTo(0.5, 1e-9)
    out[1].value.should.be.closeTo(0.5, 1e-9)
    out[2].value.should.equal(0)
  })

  it('computes negative steer -> zero leftSteer, populated rightSteer', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.5, 1.0)
    out[0].value.should.be.closeTo(-0.5, 1e-9)
    out[1].value.should.equal(0)
    out[2].value.should.be.closeTo(0.5, 1e-9)
  })

  it('normalises err > PI back into (-PI, PI] (circular wrap)', () => {
    const d = calc(makeApp(), makePlugin())
    // cog ≈ 340°, bearing = 0°: raw err = 5.934 rad, true signed error
    // is ≈ -0.349 rad (turn right 20°).
    const out = d.calculator(5.934, 0)
    out[0].value.should.be.closeTo(5.934 - 2 * Math.PI, 1e-6)
    // Right turn -> rightSteer populated, leftSteer zero.
    out[1].value.should.equal(0)
    out[2].value.should.be.closeTo(2 * Math.PI - 5.934, 1e-6)
  })

  it('normalises err < -PI back into (-PI, PI] (circular wrap)', () => {
    const d = calc(makeApp(), makePlugin())
    // cog = 0°, bearing ≈ 340°: raw err = -5.934 rad, true signed error
    // is ≈ +0.349 rad (turn left 20°).
    const out = d.calculator(0, 5.934)
    out[0].value.should.be.closeTo(2 * Math.PI - 5.934, 1e-6)
    out[1].value.should.be.closeTo(2 * Math.PI - 5.934, 1e-6)
    out[2].value.should.equal(0)
  })
})
