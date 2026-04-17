// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('setDrift — frame mismatch regression', () => {
  const calc = require('../calcs/setDrift')

  // BUG: setDrift takes navigation.headingMagnetic (magnetic frame) and
  // navigation.courseOverGroundTrue (true frame) as inputs, then mixes
  // them directly via `delta = courseOverGroundTrue - headingMagnetic`
  // and via vector decomposition that uses cos(headingMagnetic) next to
  // cos(courseOverGroundTrue). When magnetic variation is non-zero this
  // introduces an error equal to that variation. The assertions below
  // pin the values the current (frame-mixing) implementation produces.
  it('produces the current (frame-mixed) drift/setTrue for a non-zero variation', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.5, 0.7, 6, 5.5, 0.1)
    const drift = out.find((x) => x.path === 'environment.current.drift')
    const setTrue = out.find((x) => x.path === 'environment.current.setTrue')
    drift.value.should.be.closeTo(1.251241728235616, 1e-9)
    setTrue.value.should.be.closeTo(4.303481965647525, 1e-9)
  })

  // BUG: environment.current.driftImpact is not a SignalK spec path.
  // The other three outputs are valid spec paths.
  it('emits the non-spec environment.current.driftImpact path', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.5, 0.7, 6, 5.5, 0.1)
    out.map((x) => x.path).should.include('environment.current.driftImpact')
  })
})
