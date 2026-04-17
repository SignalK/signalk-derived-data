// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('leeway', () => {
  const calc = require('../calcs/leeway')

  it('returns zero leeway when stw <= 0', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0.1 }, 0)
    out.should.deep.equal([{ path: 'performance.leeway', value: 0 }])
  })

  it('computes leeway angle from roll and stw', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0.1 }, 2)
    // kFactor = 12, rollDeg = 0.1 * 360 / PI ≈ 11.4592;
    // stwKnots = 3.88768; leeway = 12 * 11.4592 / 15.11 / 360 * PI ≈ 0.07935
    out[0].path.should.equal('performance.leeway')
    out[0].value.should.be.closeTo(0.07935, 1e-3)
  })

  // BUG: `leeway.js` outputs to `performance.leeway` while the sister
  // module `leewayAngle.js` uses `navigation.leewayAngle`. Two calcs in
  // the same area writing to different paths is a documented wart; kept
  // here so we notice if anyone renames the path.
  it('writes to performance.leeway (not navigation.leewayAngle)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0 }, 1)
    out[0].path.should.equal('performance.leeway')
  })
})
