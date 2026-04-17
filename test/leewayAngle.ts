// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('leewayAngle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/leewayAngle')

  // BUG: the finite-check is inverted. The `!_.isFinite` guard means the
  // body executes only when inputs are NOT finite, producing NaN; finite
  // inputs fall through with leewayAngle = null.
  it('returns null for valid finite inputs (inverted guard)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, 0.2)
    out.should.deep.equal([{ path: 'navigation.leewayAngle', value: null }])
  })

  it('returns NaN when either input is non-finite (inverted guard branch)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(NaN, 0.2)
    Number.isNaN(out[0].value).should.equal(true)
  })
})
