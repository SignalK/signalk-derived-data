import * as chai from 'chai'
chai.should()
const expect = chai.expect

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

  it('returns undefined when draft is missing', () => {
    const app = makeApp()
    const d = calc(app, makePlugin())
    expect(d.calculator(10)).to.equal(undefined)
  })

  it('returns undefined when depthBelowSurface is not a number', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(null)).to.equal(undefined)
    expect(d.calculator(undefined)).to.equal(undefined)
  })

  it('returns undefined when depthBelowSurface is NaN', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(NaN)).to.equal(undefined)
  })

  it('reads draft once and reuses it on subsequent calls', () => {
    // Replace getSelfPath with a spy so we can assert the tree walk only
    // happens for the first calculator call. Any more than one lookup and
    // the cache isn't doing its job.
    let lookups = 0
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const realGetSelfPath = app.getSelfPath
    app.getSelfPath = (p: string) => {
      lookups += 1
      return realGetSelfPath(p)
    }
    const d = calc(app, makePlugin())
    d.calculator(10)
    d.calculator(11)
    d.calculator(12)
    lookups.should.equal(1)
  })
})
