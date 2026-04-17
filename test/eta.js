// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('eta (extra branches)', () => {
  const calc = require('../calcs/eta')

  it('uses the current time when datetime is empty', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('', 1000, 2)
    out[0].path.should.equal('navigation.courseGreatCircle.nextPoint.eta')
    out[0].value.should.be.a('string') // ISO string
  })

  it('returns null eta when velocityMadeGood is not positive', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-07-12T18:00:00Z', 1000, 0)
    expect(out[0].value).to.equal(null)
  })

  it('uses the current time when datetime is undefined', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(undefined, 1000, 2)
    out[0].value.should.be.a('string')
  })

  // BUG: inputs are rhumbline distance + VMG, but the output path is
  // courseGreatCircle.nextPoint.eta. Rhumbline and great-circle diverge
  // over long distances. Pin the current (mismatched) path here.
  it('writes the rhumbline-based eta to the greatCircle path', () => {
    const d = calc(makeApp(), makePlugin())
    d.derivedFrom.should.include(
      'navigation.courseRhumbline.nextPoint.distance'
    )
    const out = d.calculator('2024-07-12T18:00:00Z', 1000, 2)
    out[0].path.should.equal('navigation.courseGreatCircle.nextPoint.eta')
  })
})
