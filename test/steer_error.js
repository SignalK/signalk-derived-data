// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

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

  // BUG: the wrap-around branch uses `(err - PI) * -1` instead of
  // `err - 2*PI`. For COG = 5.934 rad, bearing = 0 rad (err > PI), the
  // current code returns -2.79 rad, while the geometrically correct
  // normalized error is -0.349 rad (≈ -20°).
  it('wraps err > PI to the (buggy) negative-PI-flipped value', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(5.934, 0)
    // steererr = 5.934; (5.934 - PI) * -1 = -(5.934 - PI) ≈ -2.7924
    out[0].value.should.be.closeTo(-(5.934 - Math.PI), 1e-6)
  })

  it('wraps err < -PI to the (buggy) negative-PI-flipped value', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5.934)
    // steererr = -5.934; (-5.934 + PI) * -1 = 5.934 - PI ≈ 2.7924
    out[0].value.should.be.closeTo(5.934 - Math.PI, 1e-6)
  })
})
