import * as chai from 'chai'
chai.should()
const expect = chai.expect

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

  it('returns undefined when draft is missing', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(5)).to.equal(undefined)
  })

  it('returns undefined when depthBelowKeel is not a number', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(null)).to.equal(undefined)
    expect(d.calculator(undefined)).to.equal(undefined)
  })

  it('returns undefined when depthBelowKeel is NaN', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(NaN)).to.equal(undefined)
  })
})
