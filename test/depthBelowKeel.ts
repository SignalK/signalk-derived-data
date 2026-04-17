// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('depthBelowKeel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/depthBelowKeel')

  it('subtracts draft from belowSurface', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(10)
    out.should.deep.equal([{ path: 'environment.depth.belowKeel', value: 8.5 }])
  })

  // BUG: no guard against undefined draft. Result becomes NaN when
  // design.draft.value.maximum is missing. depthBelowKeel2.js shows the
  // correct null-guard pattern.
  it('returns NaN when draft is missing (current behaviour)', () => {
    const app = makeApp()
    const d = calc(app, makePlugin())
    const out = d.calculator(10)
    Number.isNaN(out[0].value).should.equal(true)
  })
})
