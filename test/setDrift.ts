// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('setDrift — frame mismatch regression', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/setDrift')

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
    const drift = out.find((x: any) => x.path === 'environment.current.drift')
    const setTrue = out.find(
      (x: any) => x.path === 'environment.current.setTrue'
    )
    drift.value.should.be.closeTo(1.251241728235616, 1e-9)
    setTrue.value.should.be.closeTo(4.303481965647525, 1e-9)
  })

  // BUG: environment.current.driftImpact is not a SignalK spec path.
  // The other three outputs are valid spec paths.
  it('emits the non-spec environment.current.driftImpact path', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.5, 0.7, 6, 5.5, 0.1)
    out
      .map((x: any) => x.path)
      .should.include('environment.current.driftImpact')
  })

  // Covers the null/undefined guard inside normalizeAngle. Exported from
  // calcs/setDrift.js for testability — the guard is defensive and is
  // never reached through the calculator path (atan2/cos/sin outputs are
  // always finite, and magneticVariation is filtered to non-null
  // upstream before normalizeAngle is called).
  describe('normalizeAngle', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { normalizeAngle } = require('../src/calcs/setDrift') as {
      normalizeAngle: (angle: number | null | undefined) => number | null
    }

    it('returns null for null and undefined', () => {
      ;(normalizeAngle(null) === null).should.equal(true)
      ;(normalizeAngle(undefined) === null).should.equal(true)
    })

    it('wraps positive values above 2*PI back into [0, 2*PI)', () => {
      normalizeAngle(2 * Math.PI + 0.1)!.should.be.closeTo(0.1, 1e-9)
    })

    it('wraps negative values into [0, 2*PI)', () => {
      normalizeAngle(-0.1)!.should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
    })
  })
})
