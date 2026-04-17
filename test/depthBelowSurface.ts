// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('depthBelowSurface', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/depthBelowSurface')

  it('adds draft to belowKeel', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(8.5)
    out.should.deep.equal([
      { path: 'environment.depth.belowSurface', value: 10 }
    ])
  })

  // BUG: no guard against missing draft; result becomes NaN.
  it('returns NaN when draft is missing (current behaviour)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(5)
    Number.isNaN(out[0].value).should.equal(true)
  })
})
