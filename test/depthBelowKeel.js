const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('depthBelowKeel', () => {
  const calc = require('../calcs/depthBelowKeel')

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
})
