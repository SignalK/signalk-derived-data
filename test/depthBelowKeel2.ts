import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('depthBelowKeel2', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/depthBelowKeel2')

  it('subtracts transducerToKeel from belowTransducer', () => {
    const app = makeApp({
      selfPaths: { environment: { depth: { transducerToKeel: { value: 1 } } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(9)
    out.should.deep.equal([{ path: 'environment.depth.belowKeel', value: 8 }])
  })

  it('defaults transducerToKeel to 0 when missing', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(7.5)
    out.should.deep.equal([{ path: 'environment.depth.belowKeel', value: 7.5 }])
  })

  it('returns undefined when belowTransducer is not a number', () => {
    const d = calc(makeApp(), makePlugin())
    expect(d.calculator(null)).to.equal(undefined)
    expect(d.calculator(undefined)).to.equal(undefined)
    expect(d.calculator('x')).to.equal(undefined)
  })

  it('returns undefined when transducerToKeel is not a number', () => {
    const app = makeApp({
      selfPaths: {
        environment: { depth: { transducerToKeel: { value: 'bad' } } }
      }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(9)).to.equal(undefined)
  })

  it('returns undefined when the sum is NaN', () => {
    const app = makeApp({
      selfPaths: {
        environment: { depth: { transducerToKeel: { value: 1 } } }
      }
    })
    const d = calc(app, makePlugin())
    // NaN passes the `typeof === 'number'` guard, then NaN + 1 = NaN,
    // which is caught by the explicit isNaN check.
    expect(d.calculator(NaN)).to.equal(undefined)
  })
})
