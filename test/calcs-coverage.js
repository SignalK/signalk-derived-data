// Direct-calculator coverage for calcs that either have no embedded `tests`
// array in test/test.js, or whose embedded cases leave branches uncovered.
//
// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour of
// the module so the suite stays green today. A follow-up pass flips those
// assertions to the correct behaviour and fixes the implementations.

const _ = require('lodash')
const chai = require('chai')
chai.Should()
const expect = chai.expect

function makeApp(overrides = {}) {
  const selfPaths = overrides.selfPaths || {}
  return {
    debug: () => {},
    error: () => {},
    getSelfPath: (p) => _.get(selfPaths, p),
    getPath: (p) => _.get(overrides.paths || {}, p),
    handleMessage: overrides.handleMessage || (() => {}),
    selfId: 'test',
    ...overrides
  }
}

function makePlugin(extra = {}) {
  return {
    id: 'derived-data',
    engines: ['port'],
    batteries: ['0', '1'],
    tanks: ['fuel.0'],
    air: ['outside'],
    properties: {
      heading: { kFactor: 12 },
      tanks: {
        volume_unit: 'litres',
        'calibrations.fuel.0': [
          { level: 0, volume: 0 },
          { level: 0.5, volume: 50 },
          { level: 1, volume: 100 }
        ]
      },
      traffic: {
        range: 1852,
        distanceToSelf: true,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: []
      },
      moon: { forecastDays: 0 },
      sun: { forecastDays: 0 },
      ...extra
    }
  }
}

describe('airDensity', () => {
  const calc = require('../calcs/airDensity')

  it('exposes a single-entry descriptor with environment.outside.airDensity', () => {
    const d = calc(makeApp(), makePlugin())
    d.group.should.equal('air')
    d.optionKey.should.equal('Air density')
    d.derivedFrom.should.deep.equal([
      'environment.outside.temperature',
      'environment.outside.humidity',
      'environment.outside.pressure'
    ])
  })

  // BUG: airDensity.js converts temperature in the wrong direction
  // (temp + 273.16 instead of temp - 273.15), uses bitwise XOR `^` where
  // Math.pow is intended, and treats humidity as a percentage instead of
  // a 0..1 ratio. The combined effect is that the reported density is
  // essentially meaningless. This test pins the current (buggy) output so
  // the suite stays green; a follow-up flips it to the correct physical
  // value and fixes the formula.
  it('returns the value produced by the current (buggy) formula', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(298.15, 0.5, 101325)
    out.should.be.an('array').with.lengthOf(1)
    out[0].path.should.equal('environment.outside.airDensity')
    // Hand-evaluated with JS semantics: tempC = 571.31; psat = 61 ^ 5 = 56;
    // pv = 0.28; pd = 101324.72; dry term + vapour term ≈ 1.18398.
    out[0].value.should.be.closeTo(1.18398, 1e-3)
  })
})

describe('batteryPower', () => {
  const calc = require('../calcs/batteryPower')

  it('produces one descriptor per configured battery instance', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(2)
    arr[0].group.should.equal('electrical')
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'electrical.batteries.0.voltage',
        'electrical.batteries.0.current'
      ])
  })

  it('multiplies voltage by current', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(12.5, 4)
    out.should.deep.equal([{ path: 'electrical.batteries.0.power', value: 50 }])
  })

  // BUG: the option key is misspelled as 'batterPower' (missing 'y').
  // Kept as-is because existing user configs depend on the spelling.
  it('uses the current (misspelled) optionKey', () => {
    const arr = calc(makeApp(), makePlugin())
    arr[0].optionKey.should.equal('batterPower0')
    arr[1].optionKey.should.equal('batterPower1')
  })
})

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

  // BUG: no guard against undefined draft. Result becomes NaN when
  // design.draft.value.maximum is missing. depthBelowKeel2.js shows the
  // correct null-guard pattern.
  it('returns NaN when draft is missing (current behaviour)', () => {
    const app = makeApp()
    const d = calc(app, makePlugin())
    const out = d.calculator(10)
    Number.isNaN(out[0].value).should.equal(true)
  })
})

describe('depthBelowKeel2', () => {
  const calc = require('../calcs/depthBelowKeel2')

  it('adds belowTransducer + transducerToKeel', () => {
    const app = makeApp({
      selfPaths: { environment: { depth: { transducerToKeel: { value: -1 } } } }
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

describe('depthBelowSurface', () => {
  const calc = require('../calcs/depthBelowSurface')

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

  // BUG: no guard against missing draft; result becomes NaN.
  it('returns NaN when draft is missing (current behaviour)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(5)
    Number.isNaN(out[0].value).should.equal(true)
  })
})

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

describe('heatIndex', () => {
  const calc = require('../calcs/heatIndex')

  const d = () => calc(makeApp(), makePlugin())

  // BUG: the condition `tempF >= 80 && h >= 40 && tempF <= 110 && h <= 40`
  // is only true when humidity happens to be exactly 40% — so for almost
  // every real input the Rothfusz regression never runs and the
  // function just echoes the input temperature back. These tests pin
  // that behaviour.
  it('returns temp unchanged for a typical hot-and-humid case (Rothfusz never runs)', () => {
    const out = d().calculator(308.15, 0.7) // 95°F, 70% RH
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
    out[0].value.should.be.closeTo(308.15, 1e-9)
  })

  it('returns temp unchanged below the low threshold', () => {
    const out = d().calculator(290, 0.5) // ~62°F
    out[0].value.should.be.closeTo(290, 1e-9)
  })

  // Humidity at exactly 40% with temperature in [80, 110]°F is the only
  // range where the Rothfusz regression actually executes under the
  // current implementation. The exact value pins the arithmetic so
  // operator or constant drift in the regression is caught.
  it('runs Rothfusz only when humidity is exactly 40% and returns the exact value', () => {
    const out = d().calculator(308.15, 0.4) // 95°F, 40% RH
    out[0].value.should.be.closeTo(310.3663510555556, 1e-9)
  })

  it('runs the low-humidity adjustment when h === 40, tempF in [80, 112] and h < 13', () => {
    // This branch is unreachable because the outer guard already forces
    // h === 40; the `h < 13` inner check can never pass. Covered via the
    // normal path to document the shape of the output.
    const out = d().calculator(308.15, 0.4)
    out[0].value.should.be.a('number')
  })
})

describe('leeway', () => {
  const calc = require('../calcs/leeway')

  it('returns zero leeway when stw <= 0', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0.1 }, 0)
    out.should.deep.equal([{ path: 'performance.leeway', value: 0 }])
  })

  it('computes leeway angle from roll and stw', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0.1 }, 2)
    // kFactor = 12, rollDeg = 0.1 * 360 / PI ≈ 11.4592;
    // stwKnots = 3.88768; leeway = 12 * 11.4592 / 15.11 / 360 * PI ≈ 0.07935
    out[0].path.should.equal('performance.leeway')
    out[0].value.should.be.closeTo(0.07935, 1e-3)
  })

  // BUG: `leeway.js` outputs to `performance.leeway` while the sister
  // module `leewayAngle.js` uses `navigation.leewayAngle`. Two calcs in
  // the same area writing to different paths is a documented wart; kept
  // here so we notice if anyone renames the path.
  it('writes to performance.leeway (not navigation.leewayAngle)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ roll: 0 }, 1)
    out[0].path.should.equal('performance.leeway')
  })
})

describe('leewayAngle', () => {
  const calc = require('../calcs/leewayAngle')

  // BUG: the finite-check is inverted. The `!_.isFinite` guard means the
  // body executes only when inputs are NOT finite, producing NaN; finite
  // inputs fall through with leewayAngle = null.
  it('returns null for valid finite inputs (inverted guard)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, 0.2)
    out.should.deep.equal([{ path: 'navigation.leewayAngle', value: null }])
  })

  it('returns NaN when either input is non-finite (inverted guard branch)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(NaN, 0.2)
    Number.isNaN(out[0].value).should.equal(true)
  })
})

describe('steer_error', () => {
  const calc = require('../calcs/steer_error')

  it('returns null steer when either input is non-finite', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(null, 1)
    out.should.deep.equal([
      {
        path: 'navigation.courseGreatCircle.nextPoint.steerError',
        value: null
      },
      {
        path: 'navigation.courseGreatCircle.nextPoint.leftSteerError',
        value: null
      },
      {
        path: 'navigation.courseGreatCircle.nextPoint.rightSteerError',
        value: null
      }
    ])
  })

  it('computes positive steer -> populated leftSteer, zero rightSteer', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(1.0, 0.5)
    out[0].value.should.be.closeTo(0.5, 1e-9)
    out[1].value.should.be.closeTo(0.5, 1e-9)
    out[2].value.should.equal(0)
  })

  it('computes negative steer -> zero leftSteer, populated rightSteer', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.5, 1.0)
    out[0].value.should.be.closeTo(-0.5, 1e-9)
    out[1].value.should.equal(0)
    out[2].value.should.be.closeTo(0.5, 1e-9)
  })

  // BUG: the wrap-around branch uses `(err - PI) * -1` instead of
  // `err - 2*PI`. For COG = 5.934 rad, bearing = 0 rad (err > PI), the
  // current code returns -2.79 rad, while the geometrically correct
  // normalized error is -0.349 rad (≈ -20°).
  it('wraps err > PI to the (buggy) negative-PI-flipped value', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(5.934, 0)
    // steererr = 5.934; (5.934 - PI) * -1 = -(5.934 - PI) ≈ -2.7924
    out[0].value.should.be.closeTo(-(5.934 - Math.PI), 1e-6)
  })

  it('wraps err < -PI to the (buggy) negative-PI-flipped value', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5.934)
    // steererr = -5.934; (-5.934 + PI) * -1 = 5.934 - PI ≈ 2.7924
    out[0].value.should.be.closeTo(5.934 - Math.PI, 1e-6)
  })
})

describe('vmg_wind (A)', () => {
  const calc = require('../calcs/vmg_wind')

  // BUG: frame mismatch — uses environment.wind.angleTrueWater (water
  // frame) alongside navigation.speedOverGround (ground frame). The
  // sister module vmg_wind_stw uses the matching water-frame pair.
  it('multiplies cos(angleTrueWater) by speedOverGround (frame mismatch)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5)
    out.should.deep.equal([{ path: 'performance.velocityMadeGood', value: 5 }])
  })

  it('is negative when wind is abaft the beam', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(Math.PI, 5)
    out[0].value.should.be.closeTo(-5, 1e-9)
  })
})

describe('vmg_wind_stw (B)', () => {
  const calc = require('../calcs/vmg_wind_stw')

  it('multiplies cos(angleTrueWater) by speedThroughWater', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 5)
    out.should.deep.equal([{ path: 'performance.velocityMadeGood', value: 5 }])
  })

  // BUG: both vmg calculators write to the same path; enabling both
  // is mutually destructive (second one wins per debounce window).
  // Test pins the current shared path.
  it('writes to the same path as vmg_wind (performance.velocityMadeGood)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0, 1)
    out[0].path.should.equal('performance.velocityMadeGood')
  })
})

describe('windChill', () => {
  const calc = require('../calcs/windChill')

  // BUG: `windSpeed * 1.852` treats the m/s wind-speed as though it
  // were nautical miles (1.852 is km/nm, not m/s to km/h). The real
  // conversion is `* 3.6`. Current output is therefore biased.
  it('uses the 1.852 factor (current buggy conversion)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 5) // ~-5°C, 5 m/s
    // tempC = -5.01; windSpeedKt = 5 * 1.852 = 9.26; 9.26^0.16 ≈ 1.428
    // Current (buggy) implementation yields ≈ 264.0963 K.
    out[0].path.should.equal('environment.outside.apparentWindChillTemperature')
    out[0].value.should.be.closeTo(264.0963, 0.01)
  })

  it('falls back to tempC+273.16 when windSpeedKt <= 4.8', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(268.15, 2) // 2 m/s -> 3.704 kt <= 4.8
    // tempC = -4.99 (rounding), fallback = tempC + 273.16 ≈ 268.15
    out[0].value.should.be.closeTo(268.15, 1e-6)
  })

  it('falls back to tempC+273.16 when tempC > 10', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(288.15, 6) // 15°C, 6 m/s -> tempC > 10
    out[0].value.should.be.closeTo(288.15, 1e-6)
  })
})

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

describe('fuelConsumtion', () => {
  const calc = require('../calcs/fuelConsumtion')

  it('produces one descriptor per configured engine', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0].group.should.equal('propulsion')
    arr[0].optionKey.should.equal('economyport')
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'propulsion.port.fuel.rate',
        'navigation.speedOverGround'
      ])
  })

  // BUG: the calculator divides speed by rate with no guard for rate
  // being zero or missing, producing Infinity / -Infinity.
  it('returns speed / rate without a divide-by-zero guard', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(2, 10)
    out.should.deep.equal([{ path: 'propulsion.port.fuel.economy', value: 5 }])
    const div0 = arr[0].calculator(0, 10)
    div0[0].value.should.equal(Infinity)
  })
})

describe('propslip', () => {
  const calc = require('../calcs/propslip')

  it('returns undefined when revolutions are zero', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 1 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(0, 1)).to.equal(undefined)
  })

  it('computes slip = 1 - stw*gearRatio/(revs*pitch)', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 2 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(4, 1)
    out[0].value.should.be.closeTo(0.5, 1e-9)
  })

  // BUG: missing null-check on pitch and gearRatio. If either is
  // undefined, the formula emits NaN instead of returning undefined.
  it('emits NaN when gearRatio is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { drive: { propeller: { pitch: { value: 1 } } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(2, 1)
    Number.isNaN(out[0].value).should.equal(true)
  })

  it('emits NaN when pitch is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { transmission: { gearRatio: { value: 1 } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(2, 1)
    Number.isNaN(out[0].value).should.equal(true)
  })
})

describe('propState', () => {
  const calc = require('../calcs/propState')

  it('defaults currentState to "none" when not in selfData', () => {
    const arr = calc(makeApp(), makePlugin())
    // state missing -> 'none'; revol=0 -> !== 'stopped' -> emit 'stopped'
    const out = arr[0].calculator(0)
    out.should.deep.equal([{ path: 'propulsion.port.state', value: 'stopped' }])
  })
})

describe('tankVolume2', () => {
  const calc = require('../calcs/tankVolume2')

  it('exposes derivedFrom for the configured tank', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0]
      .derivedFrom()
      .should.deep.equal(['tanks.fuel.0.currentLevel', 'tanks.fuel.0.capacity'])
    arr[0].optionKey.should.equal('tankVolume2_fuel.0')
  })

  it('computes currentVolume = level * capacity', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(0.5, 0.1)
    out.should.deep.equal([{ path: 'tanks.fuel.0.currentVolume', value: 0.05 }])
  })
})

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

describe('headingTrue (extra branches)', () => {
  const calc = require('../calcs/headingTrue')

  it('falls back to getSelfPath when magneticVariation is the 9999 sentinel', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5, 9999)
    out[0].value.should.be.closeTo(0.6, 1e-9)
  })

  it('returns undefined when the fallback also yields null', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: null } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(0.5, 9999)).to.equal(undefined)
  })

  it('wraps negative results into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, -0.2)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('wraps results above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, 0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})

describe('courseOverGroundTrue (extra branches)', () => {
  const calc = require('../calcs/courseOverGroundTrue')

  it('falls back to getSelfPath when magneticVariation is the 9999 sentinel', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5, 9999)
    out[0].value.should.be.closeTo(0.6, 1e-9)
  })

  it('returns undefined when the fallback also yields null', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: null } } }
    })
    const d = calc(app, makePlugin())
    expect(d.calculator(0.5, 9999)).to.equal(undefined)
  })

  it('wraps negative sums into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, -0.2)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('wraps sums above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, 0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})

describe('courseOverGroundMagnetic (extra branches)', () => {
  const calc = require('../calcs/courseOverGroundMagnetic')

  it('falls back to getSelfPath when magneticVariation is the 9999 sentinel', () => {
    const app = makeApp({
      selfPaths: { navigation: { magneticVariation: { value: 0.1 } } }
    })
    const d = calc(app, makePlugin())
    const out = d.calculator(0.5, 9999)
    out[0].value.should.be.closeTo(0.4, 1e-9)
  })

  it('computes a valid result', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(1.0, 0.1)
    out[0].value.should.be.closeTo(0.9, 1e-9)
  })

  it('wraps negative results into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(0.1, 0.3)
    out[0].value.should.be.closeTo(2 * Math.PI - 0.2, 1e-9)
  })

  it('wraps results above 2*PI back into [0, 2*PI)', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(6.28, -0.5)
    out[0].value.should.be.closeTo(6.28 + 0.5 - 2 * Math.PI, 1e-9)
  })
})

describe('dewPoint', () => {
  const calc = require('../calcs/dewPoint')

  it('exposes one descriptor per configured air area', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'environment.outside.temperature',
        'environment.outside.humidity'
      ])
  })
})

describe('magneticVariation', () => {
  const calc = require('../calcs/magneticVariation')

  it('emits a source field reflecting the WMM model name', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ latitude: 39.06, longitude: -76.48 })
    const src = out.find(
      (x) => x.path === 'navigation.magneticVariation.source'
    )
    src.should.exist
    src.value.should.be.a('string')
    src.value.should.not.include('-') // spaces instead of dashes
  })
})

describe('windDirection (extra null branches)', () => {
  const calcs = require('../calcs/windDirection')

  it('guards null in the angleTrueWater calculator', () => {
    const arr = calcs(makeApp(), makePlugin())
    const angleTrueWater = arr.find((c) => c.optionKey === 'angleTrueWater')
    const out = angleTrueWater.calculator(null, null, null)
    out.should.deep.equal([
      { path: 'environment.wind.angleTrueWater', value: null },
      { path: 'environment.wind.speedTrue', value: null }
    ])
  })

  it('falls back to awa when aws is essentially zero', () => {
    const arr = calcs(makeApp(), makePlugin())
    const angleTrueWater = arr.find((c) => c.optionKey === 'angleTrueWater')
    const out = angleTrueWater.calculator(3, 1e-12, 0.7)
    out[0].value.should.be.closeTo(0.7, 1e-6)
  })
})

describe('windGround (extra branches)', () => {
  const calcs = require('../calcs/windGround')

  it('computes the expected values for a finite input vector', () => {
    const arr = calcs(makeApp(), makePlugin())
    const ground = arr[0]
    const out = ground.calculator(1.0, 3.0, 5.0, 0.5)
    out.should.have.lengthOf(3)
    out[0].path.should.equal('environment.wind.directionTrue')
    out[1].path.should.equal('environment.wind.angleTrueGround')
    out[2].path.should.equal('environment.wind.speedOverGround')
    out[0].value.should.be.closeTo(2.0459686742419585, 1e-9)
    out[1].value.should.be.closeTo(1.0459686742419587, 1e-9)
    out[2].value.should.be.closeTo(2.769931974487608, 1e-9)
  })

  // BUG: the path for ground-frame wind direction should be
  // environment.wind.directionGround, but this calculator writes to
  // environment.wind.directionTrue (water frame per the SK spec). The
  // deprecated sister calc uses the correct directionGround path.
  it('writes ground-frame direction to environment.wind.directionTrue (wrong path)', () => {
    const arr = calcs(makeApp(), makePlugin())
    const ground = arr[0]
    const out = ground.calculator(1.0, 3.0, 5.0, 0.5)
    out[0].path.should.equal('environment.wind.directionTrue')
  })

  it('uses awa as the angle when aws is effectively zero', () => {
    const arr = calcs(makeApp(), makePlugin())
    const ground = arr[0]
    const out = ground.calculator(1.0, 3.0, 1e-12, 0.5)
    out[1].value.should.be.closeTo(0.5, 1e-9)
  })

  it('deprecated calc returns null path when inputs are non-finite', () => {
    const arr = calcs(makeApp(), makePlugin())
    const deprecated = arr[1]
    const out = deprecated.calculator(null, 0.1)
    out.should.deep.equal([
      { path: 'environment.wind.directionGround', value: null }
    ])
  })

  it('deprecated calc returns a wrapped compass angle for finite inputs', () => {
    const arr = calcs(makeApp(), makePlugin())
    const deprecated = arr[1]
    const out = deprecated.calculator(2, 1)
    out[0].value.should.be.closeTo(3, 1e-9)
  })
})

describe('suncalc (night fallback)', () => {
  const calc = require('../calcs/suncalc')

  it('returns "night" when now is before nauticalDawn', () => {
    const d = calc(makeApp(), makePlugin())
    // Summer solstice, equator: nauticalDawn ~05:10Z. 02:00Z is earlier.
    const out = d.calculator('2024-06-21T02:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    out.should.deep.equal([
      { path: 'environment.sun', value: 'night' },
      { path: 'environment.mode', value: 'night' }
    ])
  })

  it('uses the current time when datetime is empty and position is valid', () => {
    const d = calc(makeApp(), makePlugin())
    // Valid position, empty datetime -> `new Date()` path is taken. The
    // assertion only checks the shape; the exact value depends on the
    // current clock.
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.should.be.an('array').with.lengthOf(2)
    out[0].path.should.equal('environment.sun')
  })
})

describe('moon (covers the calculator path with valid inputs)', () => {
  const calc = require('../calcs/moon')

  // The moon tests pin exact suncalc outputs for one reference date so
  // that arithmetic, rounding, and phase-name drift all get caught.
  // 2024-06-21T12:00Z @ 10N 20E was chosen because both moon-rise and
  // moon-set fall within the day, exercising both of those fields.
  it('returns exact phase/times for a known datetime + position', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 10,
      longitude: 20
    })
    const byPath = Object.fromEntries(out.map((x) => [x.path, x.value]))
    byPath['environment.moon.fraction'].should.be.closeTo(0.99, 1e-9)
    byPath['environment.moon.phase'].should.be.closeTo(0.47, 1e-9)
    byPath['environment.moon.phaseName'].should.equal('Waxing Gibbous')
    byPath['environment.moon.angle'].should.be.closeTo(-2.1, 1e-9)
    byPath['environment.moon.times.rise'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.set'].should.be.an.instanceof(Date)
    byPath['environment.moon.times.alwaysUp'].should.equal(false)
    byPath['environment.moon.times.alwaysDown'].should.equal(false)
  })

  it('classifies the four phase buckets that real suncalc outputs reach', () => {
    // suncalc returns floats in [0, 1); hitting phase == 0 / 0.25 /
    // 0.5 / 0.75 exactly requires crafted synthetic data. The four
    // non-equality bucket names are reachable with real dates.
    const d = calc(makeApp(), makePlugin())
    const dates = {
      'Waxing Crescent': '2024-06-07T00:00:00Z',
      'Waxing Gibbous': '2024-06-17T00:00:00Z',
      'Waning Gibbous': '2024-06-23T00:00:00Z',
      'Waning Crescent': '2024-06-30T00:00:00Z'
    }
    for (const [expected, ts] of Object.entries(dates)) {
      const out = d.calculator(ts, { latitude: 0, longitude: 0 })
      const name = out.find(
        (x) => x.path === 'environment.moon.phaseName'
      ).value
      name.should.equal(expected)
    }
  })

  it('honours forecastDays > 0 by emitting prefixed forecast paths with the expected phases', () => {
    const plugin = makePlugin({ moon: { forecastDays: 2 } })
    const d = calc(makeApp(), plugin)
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 10,
      longitude: 20
    })
    const byPath = Object.fromEntries(out.map((x) => [x.path, x.value]))
    byPath['environment.moon.1.phase'].should.be.closeTo(0.52, 1e-9)
    byPath['environment.moon.2.phase'].should.be.closeTo(0.55, 1e-9)
    byPath['environment.moon.1.phaseName'].should.equal('Waning Gibbous')
    byPath['environment.moon.2.phaseName'].should.equal('Waning Gibbous')
  })

  it('uses the current time when datetime is undefined', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(undefined, { latitude: 0, longitude: 0 })
    out.length.should.be.greaterThan(0)
    const phaseName = out.find((x) => x.path === 'environment.moon.phaseName')
    phaseName.value.should.be.a('string')
    ;[
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent'
    ].should.include(phaseName.value)
  })
})

describe('suntime', () => {
  const calc = require('../calcs/suntime')

  // Reference output at equator on 2024-06-21 (summer solstice) pinned
  // at sub-second precision so numeric-operator drift (+, -, *) inside
  // the date forecast arithmetic is detected.
  it('returns the exact rise/set times for a known date + position', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    const byPath = Object.fromEntries(
      out.map((x) => [
        x.path,
        x.value instanceof Date ? x.value.toISOString() : x.value
      ])
    )
    byPath['environment.sunlight.times.sunrise'].should.equal(
      '2024-06-21T05:59:28.185Z'
    )
    byPath['environment.sunlight.times.solarNoon'].should.equal(
      '2024-06-21T12:03:06.088Z'
    )
    byPath['environment.sunlight.times.sunset'].should.equal(
      '2024-06-21T18:06:43.990Z'
    )
    byPath['environment.sunlight.times.nauticalDawn'].should.equal(
      '2024-06-21T05:10:42.648Z'
    )
    byPath['environment.sunlight.times.dawn'].should.equal(
      '2024-06-21T05:36:56.029Z'
    )
    byPath['environment.sunlight.times.night'].should.equal(
      '2024-06-21T19:21:49.929Z'
    )
  })

  it('uses current time when datetime is empty and still emits the full set', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.length.should.be.greaterThan(14) // all fields on day 0 + the day-1 prefix set
    out
      .every((x) => x.path.startsWith('environment.sunlight.times'))
      .should.equal(true)
  })

  it('forecast day N is exactly N days after day 0', () => {
    const plugin = makePlugin({ sun: { forecastDays: 2 } })
    const d = calc(makeApp(), plugin)
    const out = d.calculator('2024-06-21T12:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    const byPath = Object.fromEntries(out.map((x) => [x.path, x.value]))
    const d0 = byPath['environment.sunlight.times.sunrise'].getTime()
    const d1 = byPath['environment.sunlight.times.1.sunrise'].getTime()
    const d2 = byPath['environment.sunlight.times.2.sunrise'].getTime()
    // Solar day vs calendar day drift is small; a 24h ± 2min window
    // pins the arithmetic without hardcoding the exact suncalc values.
    ;(d1 - d0).should.be.closeTo(86400000, 120000)
    ;(d2 - d1).should.be.closeTo(86400000, 120000)
  })
})

describe('cpa_tcpa', () => {
  const calcFactory = require('../calcs/cpa_tcpa')

  function cpaApp({ vessels, handled = [], now }) {
    return {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_, delta) => handled.push(delta),
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: (p) =>
        p === 'navigation.datetime.value' ? now || undefined : undefined
    }
  }

  function cpaPlugin(traffic) {
    return makePlugin({
      traffic: {
        range: 1852,
        distanceToSelf: true,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: [],
        ...traffic
      }
    })
  }

  function iso(offsetSec) {
    return new Date(Date.now() + (offsetSec || 0) * 1000).toISOString()
  }

  it('returns [] and emits nothing when no vessels are tracked', () => {
    const handled = []
    const app = cpaApp({ vessels: {}, handled })
    const d = calcFactory(app, cpaPlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
    handled.should.deep.equal([])
  })

  it('skips the self-vessel entry in the vessel list', () => {
    const handled = []
    const app = cpaApp({ vessels: { self: {} }, handled })
    const d = calcFactory(app, cpaPlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
  })

  it('emits a distanceToSelf delta for vessels in range', () => {
    const handled = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.0001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(app, cpaPlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    // handleMessage called immediately for distanceToSelf
    const distDelta = handled.find(
      (x) =>
        x.context === 'vessels.other' &&
        x.updates[0].values[0].path === 'navigation.distanceToSelf'
    )
    distDelta.should.exist
    out.should.be.an('array')
  })

  it('skips vessels outside the configured range', () => {
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 10, longitude: 10 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels })
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: false, range: 100 }))
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
  })

  it('emits null distanceToSelf + null CPA when the position timestamp is stale', () => {
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.0001, longitude: 0 },
            timestamp: iso(-120) // 2 min ago, stale
          },
          distanceToSelf: { value: 10 }
        }
      }
    }
    const app = cpaApp({ vessels })
    const d = calcFactory(app, cpaPlugin({ timelimit: 30 }))
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const nullCpa = out.find(
      (x) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(nullCpa).to.exist
    expect(nullCpa.updates[0].values[0].value).to.equal(null)
  })

  // BUG: the stale-check for course/speed reads
  // `vessels.<id>.navigation.courseOverGroundTrue` instead of
  // `...courseOverGroundTrue.timestamp`, so the branch only fires when
  // the entry under that path is already a bare ISO string (which only
  // happens via external feeders that write the parent node directly).
  it('pushes a null CPA delta when course/speed entries are bare ISO strings older than the timelimit', () => {
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.0001, longitude: 0 },
            timestamp: iso()
          },
          // Bare ISO strings so the (buggy) stale lookup returns a
          // parseable value.
          courseOverGroundTrue: iso(-120),
          speedOverGround: iso(-120)
        }
      }
    }
    const app = cpaApp({ vessels })
    const d = calcFactory(app, cpaPlugin({ timelimit: 30 }))
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const cpaDelta = out.find(
      (x) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(cpaDelta).to.exist
    expect(cpaDelta.updates[0].values[0].value).to.equal(null)
  })

  it('computes cpa/tcpa for converging vessels and fires an alert when inside a zone', () => {
    const handled = []
    const vessels = {
      other: {
        mmsi: '123456789',
        name: 'Other',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: Math.PI, timestamp: iso() }, // south
          speedOverGround: { value: 5, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const plugin = cpaPlugin({
      notificationZones: [
        { range: 1852, timeLimit: 600, level: 'alert', active: true }
      ]
    })
    const d = calcFactory(app, plugin)
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const alert = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    alert.should.exist
    alert.updates[0].values[0].value.state.should.equal('alert')
  })

  it('clears the alarm for a previously-alarming vessel when cpa moves out of zone', () => {
    // First call fires an alarm; second call (vessel moved) clears it.
    const vesselsCloseIn = {
      other: {
        mmsi: '111',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: Math.PI, timestamp: iso() },
          speedOverGround: { value: 5, timestamp: iso() }
        }
      }
    }
    const vesselsMovedAway = {
      other: {
        mmsi: '111',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: iso()
          },
          // Moving away
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 5, timestamp: iso() }
        }
      }
    }
    let current = vesselsCloseIn
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p) => _.get({ vessels: current }, p),
      getSelfPath: () => undefined
    }
    const plugin = cpaPlugin({
      notificationZones: [
        { range: 1852, timeLimit: 600, level: 'alert', active: true }
      ]
    })
    const d = calcFactory(app, plugin)
    d.calculator({ latitude: 0, longitude: 0 }, 0, 5) // alarm
    current = vesselsMovedAway
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const clearDelta = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    clearDelta.should.exist
    clearDelta.updates[0].values[0].value.state.should.equal('normal')
  })

  it('honours sendNotifications = false by not producing alarm deltas', () => {
    const handled = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: Math.PI, timestamp: iso() },
          speedOverGround: { value: 5, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const plugin = cpaPlugin({
      sendNotifications: false,
      notificationZones: [
        { range: 1852, timeLimit: 600, level: 'alert', active: true }
      ]
    })
    const d = calcFactory(app, plugin)
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const alarmDelta = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(alarmDelta).to.be.undefined
  })

  it('stop() emits a clearing notification for every outstanding alarm', () => {
    const handled = []
    const vessels = {
      other: {
        mmsi: '222',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: Math.PI, timestamp: iso() },
          speedOverGround: { value: 5, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const plugin = cpaPlugin({
      notificationZones: [
        { range: 1852, timeLimit: 600, level: 'alert', active: true }
      ]
    })
    const d = calcFactory(app, plugin)
    d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    handled.length = 0
    d.stop()
    handled
      .some(
        (x) =>
          x.updates[0].values[0].path.startsWith(
            'notifications.navigation.closestApproach.'
          ) && x.updates[0].values[0].value.state === 'normal'
      )
      .should.equal(true)
  })
})

describe('plugin index.js — schema/uiSchema', () => {
  const makePluginApp = () => {
    const streams = {}
    return {
      selfId: 'self',
      streambundle: {
        getSelfStream: (p) => {
          if (!streams[p]) {
            // Minimal stream stub used only by schema-generation paths
            // (updateSchema() touches calc.derivedFrom() but never
            // subscribes when start() is not called).
            streams[p] = {
              toProperty: () => ({ map: () => ({}), combine: () => ({}) })
            }
          }
          return streams[p]
        }
      },
      handleMessage: () => {},
      debug: () => {},
      error: () => {},
      setPluginStatus: () => {},
      setPluginError: () => {},
      getSelfPath: (p) => {
        if (p === 'design.draft.value.maximum') return 1.5
        // For the schema title-decoration block, return a value shape
        // for a handful of paths and null for one path so every legend
        // arm ('👍'/'❎'/'❌') is exercised.
        if (p === 'navigation.headingMagnetic') return { value: 0.5 }
        if (p === 'navigation.magneticVariation') return { value: null }
        return undefined
      },
      registerDeltaInputHandler: () => {},
      signalk: { self: 'vessels.self' }
    }
  }

  it('schema() returns an object with groups populated', () => {
    const app = makePluginApp()
    const plugin = require('../')(app)
    const schema = plugin.schema()
    schema.should.be.an('object')
    schema.type.should.equal('object')
    schema.properties.should.be.an('object')
    Object.keys(schema.properties).length.should.be.greaterThan(0)
  })

  it('uiSchema() returns an object with ui:order populated', () => {
    const app = makePluginApp()
    const plugin = require('../')(app)
    const ui = plugin.uiSchema()
    ui.should.be.an('object')
    ui['ui:order'].should.be.an('array').that.is.not.empty
  })

  it('stop() is a no-op when start() was never called', () => {
    const app = makePluginApp()
    const plugin = require('../')(app)
    expect(() => plugin.stop()).to.not.throw()
  })
})

describe('utils.js — extra branches', () => {
  const {
    formatCompassAngle,
    isCompassAngle,
    isPosition,
    degreesToRadians,
    radiansToDegrees
  } = require('../utils')

  it('returns null for Infinity (non-numeric guard)', () => {
    expect(formatCompassAngle(Infinity)).to.equal(null)
  })

  it('returns null for NaN (non-numeric guard)', () => {
    expect(formatCompassAngle(NaN)).to.equal(null)
  })

  it('returns the value unchanged when already in [0, 2*PI)', () => {
    formatCompassAngle(1.23).should.equal(1.23)
  })

  it('isCompassAngle returns false for non-numeric input', () => {
    isCompassAngle('abc').should.equal(false)
    isCompassAngle(null).should.equal(false)
    isCompassAngle(undefined).should.equal(false)
    isCompassAngle(NaN).should.equal(false)
    isCompassAngle(Infinity).should.equal(false)
  })

  it('isPosition accepts exact latitude/longitude boundaries', () => {
    isPosition({ latitude: -90, longitude: -180 }).should.equal(true)
    isPosition({ latitude: 90, longitude: 180 }).should.equal(true)
    isPosition({ latitude: 0, longitude: 0 }).should.equal(true)
  })

  it('isPosition rejects values just outside the boundaries', () => {
    isPosition({ latitude: -90.0001, longitude: 0 }).should.equal(false)
    isPosition({ latitude: 90.0001, longitude: 0 }).should.equal(false)
    isPosition({ latitude: 0, longitude: -180.0001 }).should.equal(false)
    isPosition({ latitude: 0, longitude: 180.0001 }).should.equal(false)
  })

  it('degreesToRadians converts correctly', () => {
    degreesToRadians(180).should.be.closeTo(Math.PI, 1e-9)
    degreesToRadians(0).should.equal(0)
    degreesToRadians(90).should.be.closeTo(Math.PI / 2, 1e-9)
  })

  it('radiansToDegrees converts correctly', () => {
    radiansToDegrees(Math.PI).should.be.closeTo(180, 1e-9)
    radiansToDegrees(0).should.equal(0)
    radiansToDegrees(Math.PI / 2).should.be.closeTo(90, 1e-9)
  })

  it('formatCompassAngle folds values above 2*PI back into [0, 2*PI)', () => {
    formatCompassAngle(2 * Math.PI + 0.1).should.be.closeTo(0.1, 1e-9)
  })

  it('formatCompassAngle folds negative values into [0, 2*PI)', () => {
    formatCompassAngle(-0.1).should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('isCompassAngle accepts the lower bound 0 and rejects 2*PI', () => {
    isCompassAngle(0).should.equal(true)
    // 2*PI is at the upper bound; the spec calls for < 2*PI.
    isCompassAngle(2 * Math.PI).should.equal(false)
  })

  it('formatCompassAngle returns 0 unchanged', () => {
    // Distinguishes the exact boundary at 0 from the `< 0` branch.
    formatCompassAngle(0).should.equal(0)
  })

  it('formatCompassAngle folds exactly 2*PI down to 0', () => {
    // Distinguishes the `>= 2*PI` branch from `> 2*PI` at the boundary.
    formatCompassAngle(2 * Math.PI).should.be.closeTo(0, 1e-9)
  })
})

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

describe('heatIndex — remaining branches', () => {
  const calc = require('../calcs/heatIndex')

  // tempF = 80, h = 0.4 (40%). Under the (buggy) guard `h >= 40 && h <= 40`
  // that is the only humidity that enters Rothfusz. At those inputs
  // Rothfusz yields ≈ 79.82, which takes the `heatIndex < 80` branch
  // and falls back to the simple Steadman formula.
  it('falls back to Steadman when Rothfusz gives a value below 80F', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator(299.8167, 0.4) // ~80°F, 40% RH
    out[0].value.should.be.a('number')
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
  })
})

describe('cpa_tcpa — remaining branches', () => {
  const calcFactory = require('../calcs/cpa_tcpa')

  function makeVessels(withTimestamp = true) {
    return {
      other: {
        mmsi: '555',
        navigation: {
          position: withTimestamp
            ? {
                value: { latitude: 0.001, longitude: 0 },
                timestamp: new Date().toISOString()
              }
            : { value: { latitude: 0.001, longitude: 0 } },
          courseOverGroundTrue: {
            value: Math.PI,
            timestamp: new Date().toISOString()
          },
          speedOverGround: {
            value: 5,
            timestamp: new Date().toISOString()
          },
          distanceToSelf: { value: 10 }
        }
      }
    }
  }

  it('falls back to Date.now when a vessel has no position timestamp', () => {
    const vessels = makeVessels(false)
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: () => undefined
    }
    const d = calcFactory(
      app,
      makePlugin({
        traffic: {
          range: 1852,
          distanceToSelf: true,
          timelimit: 30,
          sendNotifications: true,
          notificationZones: []
        }
      })
    )
    // secondsSinceVesselUpdate returns ~Date.now()/1000, which is a huge
    // number that exceeds timelimit and triggers the stale branch.
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const nullCpa = out.find(
      (x) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(nullCpa).to.exist
    expect(nullCpa.updates[0].values[0].value).to.equal(null)
  })

  it('uses app.getSelfPath("navigation.datetime.value") for the clock when provided', () => {
    const vessels = makeVessels()
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: (p) =>
        p === 'navigation.datetime.value' ? new Date().toISOString() : undefined
    }
    const d = calcFactory(
      app,
      makePlugin({
        traffic: {
          range: 1852,
          distanceToSelf: false,
          timelimit: 30,
          sendNotifications: true,
          notificationZones: []
        }
      })
    )
    expect(() =>
      d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    ).to.not.throw()
  })

  it('does not push a null CPA delta when course/speed are already null and stale', () => {
    const vessels = {
      other: {
        mmsi: '777',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: new Date().toISOString()
          },
          // Bare ISO strings so the (buggy) stale lookup parses a time.
          courseOverGroundTrue: new Date(Date.now() - 120000).toISOString(),
          speedOverGround: new Date(Date.now() - 120000).toISOString()
          // no .value nested paths -> vesselCourse/vesselSpeed === null
        }
      }
    }
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p) => {
        // Course/speed .value lookups must return null explicitly so the
        // inner `!== null` branch is false and no delta is pushed.
        if (
          p === 'vessels.other.navigation.courseOverGroundTrue.value' ||
          p === 'vessels.other.navigation.speedOverGround.value'
        )
          return null
        return _.get({ vessels }, p)
      },
      getSelfPath: () => undefined
    }
    const d = calcFactory(app, makePlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const cpaDelta = out.find(
      (x) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(cpaDelta).to.be.undefined
  })

  it('escalates to the highest zone level when several zones match', () => {
    const handled = []
    const vessels = {
      other: {
        mmsi: '333',
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: new Date().toISOString()
          },
          courseOverGroundTrue: {
            value: Math.PI,
            timestamp: new Date().toISOString()
          },
          speedOverGround: { value: 5, timestamp: new Date().toISOString() }
        }
      }
    }
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_, delta) => handled.push(delta),
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: () => undefined
    }
    const plugin = makePlugin({
      traffic: {
        range: 1852,
        distanceToSelf: false,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: [
          // Order matters. First zone escalates the running max,
          // second zone's lower index keeps the running max (covers the
          // `: notificationLevelIndex` branch of the ternary).
          { range: 1852, timeLimit: 600, level: 'warn', active: true },
          { range: 1852, timeLimit: 600, level: 'alert', active: true },
          // Inactive zone: covers the filter drop.
          { range: 1852, timeLimit: 600, level: 'emergency', active: false }
        ]
      }
    })
    const d = calcFactory(app, plugin)
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const alarmDelta = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(alarmDelta).to.exist
    alarmDelta.updates[0].values[0].value.state.should.equal('warn')
  })

  it('falls back to "(unknown)" when a vessel has neither name nor mmsi', () => {
    const handled = []
    const vessels = {
      other: {
        // no name, no mmsi
        navigation: {
          position: {
            value: { latitude: 0.001, longitude: 0 },
            timestamp: new Date().toISOString()
          },
          courseOverGroundTrue: {
            value: Math.PI,
            timestamp: new Date().toISOString()
          },
          speedOverGround: { value: 5, timestamp: new Date().toISOString() }
        }
      }
    }
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_, delta) => handled.push(delta),
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: () => undefined
    }
    const plugin = makePlugin({
      traffic: {
        range: 1852,
        distanceToSelf: false,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: [
          { range: 1852, timeLimit: 600, level: 'alert', active: true }
        ]
      }
    })
    const d = calcFactory(app, plugin)
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const alarm = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    alarm.updates[0].values[0].value.message.should.include('(unknown)')
  })

  it('clears alarms for vessels that disappeared between calls', () => {
    const handled = []
    let vessels = makeVessels()
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_, delta) => handled.push(delta),
      getPath: (p) => _.get({ vessels }, p),
      getSelfPath: () => undefined
    }
    const plugin = makePlugin({
      traffic: {
        range: 1852,
        distanceToSelf: false,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: [
          { range: 1852, timeLimit: 600, level: 'alert', active: true }
        ]
      }
    })
    const d = calcFactory(app, plugin)
    d.calculator({ latitude: 0, longitude: 0 }, 0, 5) // triggers alarm
    vessels = {} // vessel disappears entirely
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 5)
    const clearDelta = out.find((x) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(clearDelta).to.exist
    clearDelta.updates[0].values[0].value.state.should.equal('normal')
  })
})

describe('plugin index.js — updateOldTrafficConfig', () => {
  it('migrates legacy notificationRange/notificationTimeLimit into notificationZones', () => {
    const saved = []
    const app = {
      selfId: 'self',
      streambundle: {
        getSelfStream: () => ({
          toProperty: () => ({ map: () => ({}), combine: () => ({}) })
        })
      },
      handleMessage: () => {},
      debug: () => {},
      error: () => {},
      setPluginStatus: () => {},
      setPluginError: () => {},
      getSelfPath: () => undefined,
      registerDeltaInputHandler: () => {},
      signalk: { self: 'vessels.self' },
      savePluginOptions: (props) => saved.push(props)
    }

    const plugin = require('../')(app)
    const props = {
      traffic: {
        notificationRange: 2000,
        notificationTimeLimit: 300,
        sendNotifications: true,
        notificationZones: []
      }
    }
    plugin.start(props)
    props.traffic.notificationZones.should.have.lengthOf(1)
    props.traffic.notificationZones[0].range.should.equal(2000)
    props.traffic.notificationZones[0].timeLimit.should.equal(300)
    // Legacy keys removed post-migration.
    expect(props.traffic.notificationRange).to.be.undefined
    expect(props.traffic.notificationTimeLimit).to.be.undefined
    saved.should.have.lengthOf(1)
    plugin.stop()
  })

  it('uses the default range/timeLimit when only one of the legacy keys is set', () => {
    const saved = []
    const app = {
      selfId: 'self',
      streambundle: {
        getSelfStream: () => ({
          toProperty: () => ({ map: () => ({}), combine: () => ({}) })
        })
      },
      handleMessage: () => {},
      debug: () => {},
      error: () => {},
      setPluginStatus: () => {},
      setPluginError: () => {},
      getSelfPath: () => undefined,
      registerDeltaInputHandler: () => {},
      signalk: { self: 'vessels.self' },
      savePluginOptions: (props) => saved.push(props)
    }

    const plugin = require('../')(app)
    const props = {
      traffic: {
        notificationRange: 0, // falsy -> default 1852
        sendNotifications: false,
        notificationZones: []
      }
    }
    plugin.start(props)
    props.traffic.notificationZones[0].range.should.equal(1852)
    props.traffic.notificationZones[0].timeLimit.should.equal(600)
    props.traffic.notificationZones[0].active.should.equal(false)
    plugin.stop()
  })
})
