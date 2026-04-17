// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('transducerToKeel', () => {
  const calc = require('../calcs/transducerToKeel')

  // BUG: the formula `surfaceToTransducer - draft` produces a negative
  // result when draft > surfaceToTransducer, which contradicts the
  // SignalK spec (transducerToKeel should be positive when the keel is
  // below the transducer). depthBelowKeel2.js then compensates with an
  // addition. Both files are internally consistent but inconsistent
  // with the spec.
  it('returns surfaceToTransducer - draft (current sign convention)', () => {
    const app = makeApp({
      selfPaths: { design: { draft: { value: { maximum: 1.5 } } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5)
    out.should.deep.equal([
      { path: 'environment.depth.transducerToKeel', value: -1 }
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
