const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makeApp, makePlugin } = require('./helpers')

describe('windShift', () => {
  const calcFactory = require('../calcs/windShift')

  // The module keeps windAvg and alarmSent at module scope. `stop()`
  // resets windAvg; test order therefore matters. Each test explicitly
  // primes state via stop() + initial call.
  function fresh(alarm = 0.3) {
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

  it('normalises negative apparent angles by adding 2*PI', () => {
    const d = fresh(0.3)
    // Seed with a negative sample; the seed is normalised to +2*PI - 0.1.
    // A subsequent sample equal to 2*PI - 0.1 yields zero diff and no
    // emission.
    d.calculator(-0.1)
    expect(d.calculator(2 * Math.PI - 0.1)).to.equal(undefined)
  })

  it('averages angles circularly so values straddling 2*PI do not flip 180°', () => {
    const d = fresh(2 * Math.PI) // threshold large enough not to alarm
    d.calculator(0.1)
    d.calculator(6.2) // ≈ -0.0832 rad, close to windAvg on the circle
    // The circular mean of 0.1 and 6.2 is close to 0.0084 rad, not 3.15
    // as arithmetic averaging would produce. Push 0.01 (inside the
    // circular mean) and expect no delta.
    expect(d.calculator(0.01)).to.equal(undefined)
  })

  it('emits nothing on stop when no alarm was sent', () => {
    const d = fresh(0.3)
    d.calculator(0.1)
    // stop returns undefined; just verify it does not throw.
    expect(() => d.stop()).to.not.throw()
  })

  it('emits a normal delta on stop when an alarm was active', () => {
    const handled = []
    const app = makeApp({
      selfPaths: {
        environment: { wind: { directionChangeAlarm: { value: 0.3 } } }
      },
      handleMessage: (_, delta) => handled.push(delta)
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
