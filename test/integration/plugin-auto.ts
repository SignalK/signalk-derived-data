// Integration tests for auto mode: the plugin started with an empty
// configuration (what the server passes when it enables the plugin by
// default) picks calculations from what the data model holds.
//
// Only the auto-mode timers are faked, by their delay, so the Bacon
// streams keep running on real timers. Mocha has run for less than the
// start delay, so start() always schedules a fake start timer.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Bacon: any = require('baconjs')
import * as chai from 'chai'
import { getPath } from '../helpers'
import { AUTO_POLL_INTERVAL_MS } from '../../src/auto'
chai.should()

interface FakeTimer {
  fn: () => void
  cleared: boolean
}

const real = {
  setTimeout: global.setTimeout,
  setInterval: global.setInterval,
  clearTimeout: global.clearTimeout,
  clearInterval: global.clearInterval
}
let startTimers: FakeTimer[] = []
let pollTimers: FakeTimer[] = []

function fakeTimer(list: FakeTimer[], fn: () => void): FakeTimer {
  const timer = { fn, cleared: false }
  list.push(timer)
  return timer
}

function clear(timer: unknown, realClear: (t: any) => void) {
  if (startTimers.includes(timer as FakeTimer)) {
    ;(timer as FakeTimer).cleared = true
  } else if (pollTimers.includes(timer as FakeTimer)) {
    ;(timer as FakeTimer).cleared = true
  } else {
    realClear(timer)
  }
}

function node(value: unknown, $source = 'n2k.1') {
  return { value, $source }
}

function makeApp(self: Record<string, unknown>, saved: object = {}) {
  const streams: Record<string, any> = {}
  const handled: any[] = []
  const status: string[] = []
  const app: any = {
    selfId: 'test',
    streambundle: {
      getSelfStream: (path: string) => {
        if (!streams[path]) streams[path] = new Bacon.Bus()
        return streams[path]
      }
    },
    handleMessage: (_id: string, delta: unknown) => handled.push(delta),
    debug: () => {},
    error: () => {},
    setPluginStatus: (msg: string) => status.push(msg),
    setPluginError: () => {},
    getSelfPath: (path: string) => getPath(self, path),
    registerDeltaInputHandler: () => {},
    readPluginOptions: () => saved,
    signalk: { self: 'vessels.test' }
  }
  return { app, streams, handled, status }
}

function emitted(handled: any[], path: string): unknown[] {
  return handled.flatMap((delta) =>
    delta.updates[0].values
      .filter((v: any) => v.path === path)
      .map((v: any) => v.value)
  )
}

const wait = (ms: number) =>
  new Promise((resolve) => real.setTimeout(resolve, ms))

describe('plugin auto mode', function () {
  beforeEach(() => {
    startTimers = []
    pollTimers = []
    ;(global as any).setTimeout = (fn: () => void, ms?: number, ...a: any[]) =>
      // The start delay shrinks with process uptime; the stream
      // debounce timers stay well below a second.
      ms !== undefined && ms >= 1000
        ? fakeTimer(startTimers, fn)
        : (real.setTimeout as any)(fn, ms, ...a)
    ;(global as any).setInterval = (
      fn: () => void,
      ms?: number,
      ...a: any[]
    ) =>
      ms === AUTO_POLL_INTERVAL_MS
        ? fakeTimer(pollTimers, fn)
        : (real.setInterval as any)(fn, ms, ...a)
    ;(global as any).clearTimeout = (t: unknown) => clear(t, real.clearTimeout)
    ;(global as any).clearInterval = (t: unknown) =>
      clear(t, real.clearInterval)
  })

  afterEach(() => {
    Object.assign(global, real)
  })

  it('waits for sensors, then runs what their data allows', async () => {
    const self: Record<string, any> = {
      navigation: {
        headingMagnetic: node(1.0),
        magneticVariation: node(0.1)
      }
    }
    const { app, streams, handled, status } = makeApp(self)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})

    status[0]!.should.contain('waiting for sensors')
    startTimers.length.should.equal(1)
    ;(streams['navigation.headingMagnetic'] === undefined).should.equal(true)

    startTimers[0]!.fn()
    status[status.length - 1]!.should.match(
      /^Auto mode: \d+ calculations? active$/
    )
    // Variation first: debounceImmediate passes only the first of a
    // synchronous burst, which must already carry both inputs.
    streams['navigation.magneticVariation'].push(0.1)
    streams['navigation.headingMagnetic'].push(1.0)
    await wait(300)
    emitted(handled, 'navigation.headingTrue').should.have.lengthOf.above(0)

    // A compass starts reporting true heading: the calculation steps aside.
    self['navigation'].headingTrue = {
      value: 1.1,
      $source: 'n2k.2',
      values: { 'n2k.2': { value: 1.1 }, 'derived-data': { value: 1.1 } }
    }
    pollTimers[0]!.fn()
    const before = emitted(handled, 'navigation.headingTrue').length
    streams['navigation.headingMagnetic'].push(1.2)
    await wait(300)
    emitted(handled, 'navigation.headingTrue').length.should.equal(before)

    plugin.stop()
    pollTimers[0]!.cleared.should.equal(true)
  })

  it('does not count its own output as a sensor', async () => {
    const self: Record<string, any> = {
      navigation: {
        headingMagnetic: node(1.0),
        magneticVariation: node(0.1),
        headingTrue: node(1.1, 'derived-data')
      }
    }
    const { app, streams, handled } = makeApp(self)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    startTimers[0]!.fn()
    // Variation first: debounceImmediate passes only the first of a
    // synchronous burst, which must already carry both inputs.
    streams['navigation.magneticVariation'].push(0.1)
    streams['navigation.headingMagnetic'].push(1.0)
    await wait(100)
    emitted(handled, 'navigation.headingTrue').should.have.lengthOf.above(0)
    plugin.stop()
  })

  it('adds a new battery without restarting running calculations', async () => {
    const self: Record<string, any> = {
      navigation: {
        headingMagnetic: node(1.0),
        magneticVariation: node(0.1)
      }
    }
    const { app, streams, handled } = makeApp(self)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    startTimers[0]!.fn()
    // True heading debounces for 200 ms, so pushes are spaced wider.
    streams['navigation.magneticVariation'].push(0.1)
    streams['navigation.headingMagnetic'].push(1.0)
    await wait(300)

    self['electrical'] = {
      batteries: { house: { voltage: node(12.5), current: node(2) } }
    }
    pollTimers[0]!.fn()
    plugin
      .schema()
      .properties.electrical.properties.batterPowerhouse.title.should.contain(
        '(auto: active)'
      )
    // The heading calculation kept its subscription and the variation it
    // had seen, so a new heading alone produces a value.
    const before = emitted(handled, 'navigation.headingTrue').length
    streams['navigation.headingMagnetic'].push(1.2)
    await wait(300)
    emitted(handled, 'navigation.headingTrue').length.should.equal(before + 1)
    plugin.stop()
  })

  it('cancels the start delay on stop', () => {
    const { app } = makeApp({})
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    plugin.stop()
    startTimers[0]!.cleared.should.equal(true)
  })

  it('skips the start delay on a restart long after boot', async () => {
    const realUptime = process.uptime
    process.uptime = () => 600
    try {
      const self = {
        navigation: {
          headingMagnetic: node(1.0),
          magneticVariation: node(0.1)
        }
      }
      const { app, status } = makeApp(self)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const plugin = require('../../src')(app)
      plugin.start({ mode: 'auto' })
      startTimers.length.should.equal(0)
      await wait(10)
      status[status.length - 1]!.should.match(/calculations? active$/)
      plugin.stop()
    } finally {
      process.uptime = realUptime
    }
  })

  it('reports an error in a poll as a plugin error', () => {
    const { app } = makeApp({})
    const errors: string[] = []
    app.setPluginError = (msg: string) => errors.push(msg)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    app.getSelfPath = () => {
      throw new Error('boom')
    }
    ;(() => startTimers[0]!.fn()).should.not.throw()
    errors.should.deep.equal(['Auto mode: boom'])
    plugin.stop()
  })

  it('keeps a saved configuration without mode in manual mode', () => {
    const { app, status } = makeApp({})
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({ heading: { heading: false } })
    startTimers.length.should.equal(0)
    status.length.should.equal(0)
    plugin.stop()
  })

  it('finds engines in the data model', () => {
    const self = {
      propulsion: { main: { revolutions: node(20) } },
      navigation: { speedThroughWater: node(3) }
    }
    const { app } = makeApp(self)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    startTimers[0]!.fn()
    const propulsion = plugin.schema().properties.propulsion.properties
    propulsion.mainstate.title.should.contain('(auto: active)')
    propulsion.propslipmain.title.should.contain(
      'auto: waiting for propulsion.main.transmission.gearRatio.value'
    )
    ;(propulsion.statestarboard === undefined).should.equal(true)
    plugin.stop()
  })

  it('shows the status of each calculation and the mode in the schema', () => {
    const self = { navigation: { headingMagnetic: node(1.0) } }
    const { app } = makeApp(self)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../src')(app)
    plugin.start({})
    startTimers[0]!.fn()
    const schema = plugin.schema()
    schema.properties.mode.default.should.equal('auto')
    schema.properties.default_ttl.default.should.equal(5)
    schema.properties.heading.properties.heading.title.should.contain(
      '(auto: waiting for navigation.magneticVariation)'
    )
    plugin.uiSchema()['ui:order'][0].should.equal('mode')
    plugin.stop()
  })

  it('defaults the mode from the saved configuration while stopped', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../../src')(makeApp({}, {}).app)
    fresh.schema().properties.mode.default.should.equal('auto')

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const existing = require('../../src')(
      makeApp({}, { enabled: false, configuration: { heading: {} } }).app
    )
    existing.schema().properties.mode.default.should.equal('manual')
    existing.schema().properties.default_ttl.default.should.equal(0)
  })
})
