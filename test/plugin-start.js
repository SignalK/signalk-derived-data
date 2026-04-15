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
  it('starts and emits for a single-input calc (depthBelowKeel)', (done) => {
    const { app, streams, handled } = makeApp()
    const plugin = require('../')(app)

    plugin.start({
      traffic: { notificationZones: [] },
      depth: { belowKeel: true }
    })

    // Plugin uses 20 ms debounceImmediate by default; push then wait.
    app.streambundle.getSelfStream('environment.depth.belowSurface').push(10)

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
    }, 100)
  })

  it('starts and emits for a multi-input calc (set and drift)', (done) => {
    const { app, streams, handled } = makeApp()
    const plugin = require('../')(app)

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
})
