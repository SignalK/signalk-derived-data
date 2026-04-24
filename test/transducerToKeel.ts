import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('transducerToKeel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/transducerToKeel')

  it('returns draft - surfaceToTransducer (positive when keel is below transducer)', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5)
    out.should.deep.equal([
      { path: 'environment.depth.transducerToKeel', value: 1 }
    ])
  })

  it('returns undefined when surfaceToTransducer is not a number', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(null)).to.equal(undefined)
    expect(d.calculator('x')).to.equal(undefined)
  })

  it('returns undefined when draft is not a number', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(0.5)).to.equal(undefined)
  })

  it('returns undefined when the result is NaN', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: NaN } } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(NaN)).to.equal(undefined)
  })
})
