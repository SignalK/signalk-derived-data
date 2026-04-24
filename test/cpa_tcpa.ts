import * as chai from 'chai'
import { getPath } from './helpers'
chai.should()
const expect = chai.expect

import { makePlugin } from './helpers'

describe('cpa_tcpa', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calcFactory: any = require('../src/calcs/cpa_tcpa')

  function cpaApp({
    vessels,
    handled = [],
    now
  }: {
    vessels: any
    handled?: any[]
    now?: string
  }): any {
    return {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_: unknown, delta: unknown) => handled.push(delta),
      getPath: (p: string) => getPath({ vessels }, p),
      getSelfPath: (p: string) =>
        p === 'navigation.datetime.value' ? now || undefined : undefined
    }
  }

  function cpaPlugin(traffic?: any): any {
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

  function iso(offsetSec?: number): string {
    return new Date(Date.now() + (offsetSec || 0) * 1000).toISOString()
  }

  it('exposes the plug-and-play defaults (distanceToSelf on, range off, 30 min timelimit)', () => {
    const d = calcFactory(cpaApp({ vessels: {} }), cpaPlugin())
    const props = d.properties
    props.distanceToSelf.default.should.equal(true)
    props.range.default.should.equal(-1)
    props.timelimit.default.should.equal(1800)
    Object.keys(props)
      .slice(0, 3)
      .should.deep.equal(['distanceToSelf', 'range', 'timelimit'])
  })

  it('returns [] and emits nothing when no vessels are tracked', () => {
    const handled: any[] = []
    const app = cpaApp({ vessels: {}, handled })
    const d = calcFactory(app, cpaPlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
    handled.should.deep.equal([])
  })

  it('skips the self-vessel entry in the vessel list', () => {
    const handled: any[] = []
    const app = cpaApp({ vessels: { self: {} }, handled })
    const d = calcFactory(app, cpaPlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
  })

  it('emits a distanceToSelf delta for vessels in range', () => {
    const handled: any[] = []
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
      (x: any) =>
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
    const handled: any[] = []
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
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: 1852 }))
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    out.should.deep.equal([])
    handled.should.deep.equal([])
  })

  it('distanceToSelf is skipped on subsequent calls when the distance barely changes', () => {
    const handled: any[] = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.01, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: -1 }))
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    handled
      .filter(
        (x: any) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
      )
      .should.have.length(1)
    // Second call at the exact same position: distance has not changed so
    // no new delta should be emitted.
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    handled
      .filter(
        (x: any) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
      )
      .should.have.length(1)
  })

  it('distanceToSelf re-emits once the accumulated change crosses the threshold', () => {
    const handled: any[] = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.01, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: -1 }))
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    // Move self position enough to yield >1m change in computed distance.
    vessels.other.navigation.position.value = {
      latitude: 0.0105,
      longitude: 0
    }
    vessels.other.navigation.position.timestamp = iso()
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    handled
      .filter(
        (x: any) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
      )
      .should.have.length(2)
  })

  it('cheap-reject handles longitude wraparound across the ±180 meridian', () => {
    // Self at 179.9, vessel at -179.9 => great-circle arc is ~0.2deg
    // (~22km), well outside 1852m range, but the NAIVE abs(lon1-lon2)=359.8
    // would falsely accept the vessel into the cheap-reject window and fall
    // through to geolib (where the real distance also rejects it). The wrap
    // branch flips this so we still reject cheaply.
    const handled: any[] = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0, longitude: -179.9 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: 1852 }))
    const out = d.calculator({ latitude: 0, longitude: 179.9 }, 0, 0)
    out.should.deep.equal([])
    handled.should.deep.equal([])
  })

  it('cheap-reject passes vessels across the date line that are within range', () => {
    // Self at 179.9995, vessel at -179.9995 => actual delta 0.001deg
    // (~111m), well inside 1852m range. The wrap-aware cheap reject must
    // NOT drop this vessel.
    const handled: any[] = []
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0, longitude: -179.9995 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso() },
          speedOverGround: { value: 0, timestamp: iso() }
        }
      }
    }
    const app = cpaApp({ vessels, handled })
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: 1852 }))
    d.calculator({ latitude: 0, longitude: 179.9995 }, 0, 0)
    const dist = handled.find(
      (x: any) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
    )
    expect(dist).to.exist
  })

  it('cheap-reject is disabled when range < 0 and falls through to geolib', () => {
    const handled: any[] = []
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
    const d = calcFactory(app, cpaPlugin({ distanceToSelf: true, range: -1 }))
    d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    // With range disabled, we still compute distance and emit distanceToSelf.
    const dist = handled.find(
      (x: any) => x.updates[0].values[0].path === 'navigation.distanceToSelf'
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
      (x: any) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(nullCpa).to.exist
    expect(nullCpa.updates[0].values[0].value).to.equal(null)
  })

  it('pushes a null CPA delta when course/speed timestamps are older than the timelimit', () => {
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.0001, longitude: 0 },
            timestamp: iso()
          },
          courseOverGroundTrue: { value: 0, timestamp: iso(-120) },
          speedOverGround: { value: 0, timestamp: iso(-120) }
        }
      }
    }
    const app = cpaApp({ vessels })
    const d = calcFactory(app, cpaPlugin({ timelimit: 30 }))
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const cpaDelta = out.find(
      (x: any) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(cpaDelta).to.exist
    expect(cpaDelta.updates[0].values[0].value).to.equal(null)
  })

  it('computes cpa/tcpa for converging vessels and fires an alert when inside a zone', () => {
    const handled: any[] = []
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
    const alert = out.find((x: any) =>
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
    const app: any = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p: string) => getPath({ vessels: current }, p),
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
    const clearDelta = out.find((x: any) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    clearDelta.should.exist
    clearDelta.updates[0].values[0].value.state.should.equal('normal')
  })

  it('honours sendNotifications = false by not producing alarm deltas', () => {
    const handled: any[] = []
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
    const alarmDelta = out.find((x: any) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(alarmDelta).to.be.undefined
  })

  it('stop() emits a clearing notification for every outstanding alarm', () => {
    const handled: any[] = []
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
        (x: any) =>
          x.updates[0].values[0].path.startsWith(
            'notifications.navigation.closestApproach.'
          ) && x.updates[0].values[0].value.state === 'normal'
      )
      .should.equal(true)
  })
})

describe('cpa_tcpa — remaining branches', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calcFactory: any = require('../src/calcs/cpa_tcpa')

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
      getPath: (p: string) => getPath({ vessels }, p),
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
      (x: any) => x.updates[0].values[0].path === 'navigation.closestApproach'
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
      getPath: (p: string) => getPath({ vessels }, p),
      getSelfPath: (p: string) =>
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
          courseOverGroundTrue: {
            value: null,
            timestamp: new Date(Date.now() - 120000).toISOString()
          },
          speedOverGround: {
            value: null,
            timestamp: new Date(Date.now() - 120000).toISOString()
          }
        }
      }
    }
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: () => {},
      getPath: (p: string): any => getPath({ vessels }, p),
      getSelfPath: () => undefined
    }
    const d = calcFactory(app, makePlugin())
    const out = d.calculator({ latitude: 0, longitude: 0 }, 0, 0)
    const cpaDelta = out.find(
      (x: any) => x.updates[0].values[0].path === 'navigation.closestApproach'
    )
    expect(cpaDelta).to.be.undefined
  })

  it('escalates to the highest zone level when several zones match', () => {
    const handled: any[] = []
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
      handleMessage: (_: unknown, delta: unknown) => handled.push(delta),
      getPath: (p: string) => getPath({ vessels }, p),
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
    const alarmDelta = out.find((x: any) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(alarmDelta).to.exist
    alarmDelta.updates[0].values[0].value.state.should.equal('warn')
  })

  it('falls back to "(unknown)" when a vessel has neither name nor mmsi', () => {
    const handled: any[] = []
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
      handleMessage: (_: unknown, delta: unknown) => handled.push(delta),
      getPath: (p: string) => getPath({ vessels }, p),
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
    const alarm = out.find((x: any) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    alarm.updates[0].values[0].value.message.should.include('(unknown)')
  })

  it('clears alarms for vessels that disappeared between calls', () => {
    const handled: any[] = []
    let vessels: any = makeVessels()
    const app = {
      debug: () => {},
      error: () => {},
      selfId: 'self',
      handleMessage: (_: unknown, delta: unknown) => handled.push(delta),
      getPath: (p: string) => getPath({ vessels }, p),
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
    const clearDelta = out.find((x: any) =>
      x.updates[0].values[0].path.startsWith(
        'notifications.navigation.closestApproach.'
      )
    )
    expect(clearDelta).to.exist
    clearDelta.updates[0].values[0].value.state.should.equal('normal')
  })
})
