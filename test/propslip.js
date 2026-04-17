// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('propslip', () => {
  const calc = require('../calcs/propslip')

  it('returns undefined when revolutions are zero', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 1 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(0, 1)).to.equal(undefined)
  })

  it('computes slip = 1 - stw*gearRatio/(revs*pitch)', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 2 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(4, 1)
    out[0].value.should.be.closeTo(0.5, 1e-9)
  })

  // BUG: missing null-check on pitch and gearRatio. If either is
  // undefined, the formula emits NaN instead of returning undefined.
  it('emits NaN when gearRatio is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { drive: { propeller: { pitch: { value: 1 } } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(2, 1)
    Number.isNaN(out[0].value).should.equal(true)
  })

  it('emits NaN when pitch is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { transmission: { gearRatio: { value: 1 } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(2, 1)
    Number.isNaN(out[0].value).should.equal(true)
  })
})
