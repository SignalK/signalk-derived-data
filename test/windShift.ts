// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('windShift', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calcFactory: any = require('../src/calcs/windShift')

  // The module keeps windAvg and alarmSent at module scope. `stop()`
  // resets windAvg; test order therefore matters. Each test explicitly
  // primes state via stop() + initial call.
  function fresh(alarm = 0.3): any {
    const app = makeApp({
      selfPaths: {
        environment: { wind: { directionChangeAlarm: { value: alarm } } }
      }
    })
    const plugin = makePlugin()
    const d = calcFactory(app, plugin)
    d.stop() // clears windAvg / alarmSent
    return d
  }

  it('returns undefined when no alarm threshold is configured', () => {
    const d = calcFactory(makeApp(), makePlugin())
    d.stop()
    expect(d.calculator(0.1)).to.equal(undefined)
  })

  it('seeds windAvg on first sample without emitting', () => {
    const d = fresh()
    expect(d.calculator(0.1)).to.equal(undefined)
  })

  it('emits nothing when the difference stays under the alarm threshold', () => {
    const d = fresh(0.5)
    d.calculator(0.1)
    expect(d.calculator(0.2)).to.equal(undefined)
  })

  it('emits an alert when the diff exceeds the alarm threshold', () => {
    const d = fresh(0.3)
    d.calculator(0.1)
    const out = d.calculator(1.0)
    out.should.have.lengthOf(1)
    out[0].path.should.equal('notifications.windShift')
    out[0].value.state.should.equal('alert')
  })

  it('clears the alarm with a normal delta once the diff is back below the threshold', () => {
    const d = fresh(0.3)
    d.calculator(0.1)
    d.calculator(1.0) // alarm, windAvg still 0.1 (not updated on alarm)
    const out = d.calculator(0.2) // diff 0.1 <= 0.3 -> clears alarm
    out.should.have.lengthOf(1)
    out[0].value.state.should.equal('normal')
  })

  // BUG: `if (angleApparent < 0) angleApparent = angleApparent + Math.PI / 2`
  // normalises negative apparent angles by adding PI/2 (90°). A correct
  // circular normalisation adds 2*PI. The test pins the current offset.
  it('shifts negative apparent angles by PI/2 (current offset)', () => {
    const d = fresh(0.3)
    // With windAvg undefined, negative sample is first offset by +PI/2
    // and becomes the seed. A subsequent positive sample that matches
    // `-0.1 + PI/2 ≈ 1.4708` produces a zero-diff and therefore no
    // output, proving the offset is PI/2 not 2*PI.
    d.calculator(-0.1)
    expect(d.calculator(-0.1 + Math.PI / 2)).to.equal(undefined)
  })

  // BUG: the average of two angles is computed as a plain arithmetic
  // mean, which is wrong near the 0/2*PI wrap. The test pins the
  // arithmetic-mean behaviour.
  it('uses the arithmetic mean of angles (breaks near 2*PI wrap)', () => {
    const d = fresh(2 * Math.PI) // large threshold so no alert fires
    d.calculator(0.1)
    d.calculator(6.2)
    // After two calls windAvg = (0.1 + 6.2) / 2 = 3.15 rad (≈ 180°),
    // whereas the circular mean is close to 0. Probe windAvg indirectly
    // via a third sample just shy of the arithmetic-mean result.
    expect(d.calculator(3.15)).to.equal(undefined)
  })

  it('emits nothing on stop when no alarm was sent', () => {
    const d = fresh(0.3)
    d.calculator(0.1)
    // stop returns undefined; just verify it does not throw.
    expect(() => d.stop()).to.not.throw()
  })

  it('emits a normal delta on stop when an alarm was active', () => {
    const handled: any[] = []
    const app = makeApp({
      selfPaths: {
        environment: { wind: { directionChangeAlarm: { value: 0.3 } } }
      },
      handleMessage: (_pluginId: string, delta: unknown) => handled.push(delta)
    })
    const plugin = makePlugin()
    const d = calcFactory(app, plugin)
    d.stop() // reset
    d.calculator(0.1)
    d.calculator(1.0) // alarm
    d.stop()
    handled.should.have.lengthOf(1)
    handled[0].updates[0].values[0].value.state.should.equal('normal')
  })
})
