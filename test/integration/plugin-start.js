// Regression tests for plugin.start() — the existing test.js suite calls
// calculator functions directly (calc.calculator.apply(null, input)) and
// never exercises the stream pipeline. This file enables a calculation
// through plugin.start() and pushes deltas into a mocked streambundle so
// that the combineStreamsWith → .filter → .changes → .debounceImmediate
// chain actually runs end to end.
//
// Single-input calcs (depthBelowKeel, transducerToKeel, windShift, ...)
// hit a different code path than multi-input calcs because the helper's
// reduce only runs the seed step. Both paths need coverage.

const Bacon = require('baconjs')
const chai = require('chai')
chai.Should()

function makeApp() {
  const streams = {}
  const handled = []
  const app = {
    selfId: 'test',
    streambundle: {
      getSelfStream: (path) => {
        if (!streams[path]) streams[path] = new Bacon.Bus()
        return streams[path]
      }
    },
    handleMessage: (id, delta) => handled.push(delta),
    debug: () => {},
    error: () => {},
    setPluginStatus: () => {},
    setPluginError: () => {},
    // depthBelowKeel uses app.getSelfPath('design.draft.value.maximum')
    // to get the boat's draft. Return a fixed value so the calc has the
    // input it needs without having to push it through a stream.
    getSelfPath: (path) => {
      if (path === 'design.draft.value.maximum') return 1.5
      return undefined
    },
    registerDeltaInputHandler: () => {},
    signalk: { self: 'vessels.test' }
  }
  return { app, streams, handled }
}

describe('plugin.start() stream pipeline', function () {
  it('does not throw when the traffic config section is missing entirely', () => {
    const { app } = makeApp()
    const plugin = require('../..')(app)
    // A fresh install saves an empty config; plugin.start must not
    // crash just because the `traffic` section has not been created.
    ;(() => plugin.start({ depth: { belowKeel: true } })).should.not.throw()
    plugin.stop()
  })

  it('initialises traffic.notificationZones to [] when the key is absent', () => {
    // Covers the `if (!plugin.properties.traffic.notificationZones)` arm,
    // i.e. `traffic` is set but the zones list is missing (e.g. a
    // pre-notificationZones config migrated forward).
    const { app } = makeApp()
    const plugin = require('../..')(app)
    const props = { traffic: { sendNotifications: true } }
    plugin.start(props)
    props.traffic.notificationZones.should.deep.equal([])
    plugin.stop()
  })

  it('starts and emits for a single-input calc (depthBelowKeel)', (done) => {
    const { app, streams, handled } = makeApp()
    const plugin = require('../..')(app)

    plugin.start({
      traffic: { notificationZones: [] },
      depth: { belowKeel: true }
    })

    // Push the same value twice. The second emission triggers the
    // `.skipDuplicates(skip_function)` comparator, which covers the
    // non-ttl skip_function branch in plugin.start.
    app.streambundle.getSelfStream('environment.depth.belowSurface').push(10)
    setTimeout(
      () =>
        app.streambundle
          .getSelfStream('environment.depth.belowSurface')
          .push(10),
      40
    )

    setTimeout(() => {
      try {
        // The depthBelowKeel calc subtracts max draft from the surface
        // depth: 10 - 1.5 = 8.5
        handled.length.should.be.greaterThan(0)
        const delta = handled[0]
        delta.context.should.equal('vessels.test')
        const values = delta.updates[0].values
        const dbk = values.find((v) => v.path === 'environment.depth.belowKeel')
        dbk.should.exist
        done()
      } catch (e) {
        done(e)
      }
    }, 150)
  })

  it('honours default_ttl > 0 by using the throttling skip_function', (done) => {
    const { app, handled } = makeApp()
    const plugin = require('../..')(app)

    plugin.start({
      default_ttl: 1, // seconds
      traffic: { notificationZones: [] },
      depth: { belowKeel: true }
    })

    // Push the same value repeatedly; the ttl skip_function should
    // still emit the first one and throttle subsequent duplicates until
    // ttl elapses.
    const stream = app.streambundle.getSelfStream(
      'environment.depth.belowSurface'
    )
    stream.push(10)
    setTimeout(() => stream.push(10), 30)
    setTimeout(() => stream.push(10), 60)

    setTimeout(() => {
      try {
        handled.length.should.be.greaterThan(0)
        plugin.stop()
        done()
      } catch (e) {
        done(e)
      }
    }, 150)
  })

  it('starts and emits for a multi-input calc (set and drift)', (done) => {
    const { app, handled } = makeApp()
    const plugin = require('../..')(app)

    plugin.start({
      traffic: { notificationZones: [] },
      'course data': { setDrift: true }
    })

    app.streambundle.getSelfStream('navigation.headingMagnetic').push(0.6)
    app.streambundle.getSelfStream('navigation.courseOverGroundTrue').push(0.5)
    app.streambundle.getSelfStream('navigation.speedThroughWater').push(4.8)
    app.streambundle.getSelfStream('navigation.speedOverGround').push(5.0)

    setTimeout(() => {
      try {
        handled.length.should.be.greaterThan(0)
        const delta = handled[0]
        delta.updates[0].values.length.should.be.greaterThan(0)
        done()
      } catch (e) {
        done(e)
      }
    }, 100)
  })

  it('starts and emits for a multi-input calc with mixed defaults (true heading)', (done) => {
    const { app, handled } = makeApp()
    const plugin = require('../..')(app)

    plugin.start({
      traffic: { notificationZones: [] },
      heading: { heading: true }
    })

    // headingTrue: derivedFrom = [headingMagnetic, magneticVariation],
    // defaults = [undefined, 9999]. magneticVariation is the second slot
    // and is defaulted to the 9999 sentinel; the calc falls back to
    // app.getSelfPath('navigation.magneticVariation.value') in that case.
    // Push variation BEFORE heading so the first combineWith fire already
    // has a real value (debounceImmediate(20) collapses synchronous bursts).
    app.streambundle.getSelfStream('navigation.magneticVariation').push(0.1)
    app.streambundle.getSelfStream('navigation.headingMagnetic').push(0.5)

    setTimeout(() => {
      try {
        handled.length.should.be.greaterThan(0)
        const values = handled[0].updates[0].values
        const ht = values.find((v) => v.path === 'navigation.headingTrue')
        ht.should.exist
        // 0.5 + 0.1 = 0.6 rad
        ht.value.should.be.closeTo(0.6, 1e-9)
        done()
      } catch (e) {
        done(e)
      }
    }, 100)
  })

  it('forwards calculator-authored deltas that include their own context (cpa_tcpa)', (done) => {
    // cpa_tcpa is the only calc that emits deltas with an outer
    // `context` property. The onValue branch that forwards such deltas
    // directly (instead of wrapping them in a self-context delta) is
    // only reached via this calc.
    const { app, handled } = makeApp()
    // cpa_tcpa reads app.getPath(...) for other vessels. Return an
    // empty vessel list so the calc produces at least one pass without
    // throwing but emits no context-bearing deltas of its own. That
    // still exercises the onValue branch: an empty array short-circuits
    // `values.length > 0`, so we also inject a tiny vessel to force a
    // distanceToSelf delta (which has its own context).
    const vessels = {
      other: {
        navigation: {
          position: {
            value: { latitude: 0.0001, longitude: 0 },
            timestamp: new Date().toISOString()
          },
          courseOverGroundTrue: {
            value: 0,
            timestamp: new Date().toISOString()
          },
          speedOverGround: { value: 0, timestamp: new Date().toISOString() }
        }
      }
    }
    app.getPath = (p) => require('lodash').get({ vessels }, p)

    const plugin = require('../..')(app)
    plugin.start({
      traffic: {
        range: 1852,
        distanceToSelf: true,
        timelimit: 30,
        sendNotifications: false,
        notificationZones: [],
        CPA: true
      }
    })

    app.streambundle
      .getSelfStream('navigation.position')
      .push({ latitude: 0, longitude: 0 })
    app.streambundle.getSelfStream('navigation.courseOverGroundTrue').push(0)
    app.streambundle.getSelfStream('navigation.speedOverGround').push(0)

    setTimeout(() => {
      try {
        // cpa_tcpa's distanceToSelf delta is forwarded via handleMessage
        // with its own context.
        const distDelta = handled.find(
          (d) =>
            d.context === 'vessels.other' &&
            d.updates[0].values[0].path === 'navigation.distanceToSelf'
        )
        distDelta.should.exist
        plugin.stop()
        done()
      } catch (e) {
        done(e)
      }
    }, 5100) // cpa_tcpa uses debounceDelay: 5000 ms
  }).timeout(10000)

  it('starts and emits for a single-input calc with dynamic derivedFrom (tankVolume)', (done) => {
    const { app, handled } = makeApp()
    const plugin = require('../..')(app)

    // tankVolume's derivedFrom is a function returning a 1-element array.
    // This exercises both the dynamic-derivedFrom branch in plugin.start
    // and the single-input combineStreamsWith path. We use the default
    // tank instance 'fuel.0' from defaultTanks.
    plugin.start({
      traffic: { notificationZones: [] },
      tank_instances: 'fuel.0',
      tanks: {
        'tankVolume_fuel.0': true,
        volume_unit: 'litres',
        'calibrations.fuel.0': [
          { level: 0, volume: 0 },
          { level: 0.5, volume: 50 },
          { level: 1, volume: 100 }
        ]
      }
    })

    app.streambundle.getSelfStream('tanks.fuel.0.currentLevel').push(0.5)

    setTimeout(() => {
      try {
        handled.length.should.be.greaterThan(0)
        const values = handled[0].updates[0].values
        const cap = values.find((v) => v.path === 'tanks.fuel.0.capacity')
        const cur = values.find((v) => v.path === 'tanks.fuel.0.currentVolume')
        cap.should.exist
        cur.should.exist
        // 50 L at level 0.5 -> 0.05 m^3
        cur.value.should.be.closeTo(0.05, 1e-3)
        done()
      } catch (e) {
        done(e)
      }
    }, 100)
  })
})
