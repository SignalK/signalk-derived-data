const _ = require('lodash')
const chai = require('chai')
chai.Should()
const expect = chai.expect

const { makePlugin } = require('./helpers')

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

  it('cheap-reject skips distanceToSelf emission for far vessels when range>=0', () => {
    // When a positive range is configured, a vessel whose coarse lat/lon
    // delta already exceeds the range is filtered before the geolib call,
    // which also suppresses the per-tick distanceToSelf emission. Users who
    // want distances for arbitrarily-far vessels should set range < 0.
    const handled = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 10, longitude: 10 }, // ~1500km away
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(
      app,
      cpaPlugin({ distanceToSelf: true, range: 1852 })
    )
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
    handled.should.deep.equal([])
  })

  it('cheap-reject is disabled when range < 0 and falls through to geolib', () => {
    const handled = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 1, longitude: 0 }, // ~111 km away
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(
      app,
      cpaPlugin({ distanceToSelf: true, range: -1 })
    )
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    // With range disabled, we still compute distance and emit distanceToSelf.
    const dist = handled.find(
      (x) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
    )
    expect(dist).to.exist
    expect(dist.updates[0].values[0].value).to.be.greaterThan(100000)
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
