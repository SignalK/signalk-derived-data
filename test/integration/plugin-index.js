// Integration tests for index.js — the plugin factory itself.
//
// These tests wire a fake SignalK app through require('../..'), which
// in turn loads every calc module and builds a schema. Because they
// span index.js + utils.js + every calc, they are integration tests
// rather than unit tests.

const path = require('path')
const fs = require('fs')
const Bacon = require('baconjs')
const chai = require('chai')
chai.Should()
const expect = chai.expect

// Every real calc in calcs/ sets a `group`, so the plugin's nogroup code
// paths (schema flattening, start()'s `else if (!props[optionKey])`,
// function-valued `properties`) are unreachable through production code.
// This helper writes a synthetic calc file into calcs/ (under a
// __test_ prefix so there's no chance of shadowing a real name), then
// removes it on cleanup. The calc's descriptor is supplied via a small
// generated source file so Node's real module resolver accepts it; a
// `__basename__` marker in calculator output lets tests confirm which
// calc ran.
function installFakeCalc(descriptor, basename = '__test_nogroup_calc') {
  const calcsDir = path.join(__dirname, '../../calcs')
  const fakePath = path.join(calcsDir, basename + '.js')
  const indexPath = require.resolve('../..')

  const origIndexCacheEntry = require.cache[indexPath]
  const src = `module.exports = function () { return ${JSON.stringify(descriptor, (k, v) => (typeof v === 'function' ? '__FN__:' + v.toString() : v))}; }`
  // Serialise functions inside the descriptor as markers and rebuild
  // them in a tiny wrapper so JSON.stringify doesn't drop them.
  const srcWithFns = `
    const desc = ${serialiseDescriptor(descriptor)}
    module.exports = function () { return desc }
  `
  fs.writeFileSync(fakePath, srcWithFns)

  // Force a fresh index.js load so load_calcs runs and picks up the new
  // file from disk.
  delete require.cache[indexPath]
  delete require.cache[fakePath]

  return function cleanup() {
    try {
      fs.unlinkSync(fakePath)
    } catch (e) {}
    delete require.cache[fakePath]
    delete require.cache[indexPath]
    if (origIndexCacheEntry) require.cache[indexPath] = origIndexCacheEntry
  }
}

// Walks the descriptor object and emits a JS source literal that
// preserves nested function values (schema `properties` is sometimes a
// function). Arrays and plain objects recurse; functions are inlined
// via Function#toString.
function serialiseDescriptor(obj) {
  if (obj === null || obj === undefined) return String(obj)
  if (typeof obj === 'function') return obj.toString()
  if (Array.isArray(obj)) {
    return '[' + obj.map(serialiseDescriptor).join(', ') + ']'
  }
  if (typeof obj === 'object') {
    return (
      '{' +
      Object.entries(obj)
        .map(([k, v]) => JSON.stringify(k) + ': ' + serialiseDescriptor(v))
        .join(', ') +
      '}'
    )
  }
  return JSON.stringify(obj)
}

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
    const plugin = require('../..')(app)
    const schema = plugin.schema()
    schema.should.be.an('object')
    schema.type.should.equal('object')
    schema.properties.should.be.an('object')
    Object.keys(schema.properties).length.should.be.greaterThan(0)
  })

  it('uiSchema() returns an object with ui:order populated', () => {
    const app = makePluginApp()
    const plugin = require('../..')(app)
    const ui = plugin.uiSchema()
    ui.should.be.an('object')
    ui['ui:order'].should.be.an('array').that.is.not.empty
  })

  it('stop() is a no-op when start() was never called', () => {
    const app = makePluginApp()
    const plugin = require('../..')(app)
    expect(() => plugin.stop()).to.not.throw()
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

    const plugin = require('../..')(app)
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

    const plugin = require('../..')(app)
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

describe('plugin index.js — nogroup and function-properties calcs', () => {
  // These cases all need a calc without a `group` field, which no real
  // calc in calcs/ has. We synthesise one via installFakeCalc and verify
  // the plugin wires it up through every otherwise-unreachable branch:
  //   - schema(): the `groups.nogroup` top-level flattening path
  //   - schema(): a calc whose `properties` is a function (both in the
  //     grouped and nogroup branches)
  //   - start(): the `else if (!props[calculation.optionKey])` early-out
  const makeApp = () => ({
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
    signalk: { self: 'vessels.self' }
  })

  it('flattens a nogroup calc with function-valued properties into schema root', () => {
    const cleanup = installFakeCalc({
      // No `group` -> flows through the `groups.nogroup` branch in
      // updateSchema and exposes the optionKey at the top level.
      optionKey: '__fakeNogroup',
      title: 'Fake No-Group Calc',
      derivedFrom: ['environment.outside.temperature'],
      // Function form of `properties` -> covers the
      // `typeof calc.properties === 'function'` arm in the nogroup block.
      properties: () => ({
        __fakeNogroupParam: {
          type: 'string',
          title: 'Fake param',
          default: 'x'
        }
      }),
      calculator: () => null
    })
    try {
      const plugin = require('../..')(makeApp())
      const schema = plugin.schema()
      schema.properties.should.have.property('__fakeNogroup')
      schema.properties.__fakeNogroup.type.should.equal('boolean')
      // Function-valued properties were resolved and merged at schema root.
      schema.properties.should.have.property('__fakeNogroupParam')
      schema.properties.__fakeNogroupParam.default.should.equal('x')

      const ui = plugin.uiSchema()
      ui['ui:order'].should.include('__fakeNogroup')
    } finally {
      cleanup()
    }
  })

  it('resolves function-valued properties on grouped calcs too', () => {
    const cleanup = installFakeCalc(
      {
        group: 'fakegroup',
        optionKey: '__fakeGrouped',
        title: 'Fake Grouped Calc',
        derivedFrom: ['environment.outside.temperature'],
        // Function form again, but inside a group -> covers the parallel
        // `typeof calc.properties === 'function'` arm in the grouped block.
        properties: () => ({
          __fakeGroupedParam: { type: 'number', title: 'Fake', default: 1 }
        }),
        calculator: () => null
      },
      '__fake_grouped_calc'
    )
    try {
      const plugin = require('../..')(makeApp())
      const schema = plugin.schema()
      schema.properties.should.have.property('fakegroup')
      const group = schema.properties.fakegroup
      group.properties.should.have.property('__fakeGrouped')
      group.properties.should.have.property('__fakeGroupedParam')

      const ui = plugin.uiSchema()
      ui.fakegroup['ui:order'].should.include('__fakeGrouped')
      ui.fakegroup['ui:order'].should.include('__fakeGroupedParam')
    } finally {
      cleanup()
    }
  })

  it('merges object-valued properties on a nogroup calc into schema root', () => {
    // Sibling of the "function-valued properties" test — covers the
    // non-function arm of `typeof calc.properties === 'function' ? ... : ...`
    // inside the nogroup branch.
    const cleanup = installFakeCalc(
      {
        optionKey: '__fakeNogroupObj',
        title: 'Fake No-Group Obj Calc',
        derivedFrom: ['environment.outside.temperature'],
        properties: {
          __fakeNogroupObjParam: {
            type: 'number',
            title: 'Fake obj param',
            default: 2
          }
        },
        calculator: () => null
      },
      '__test_nogroup_obj_calc'
    )
    try {
      const plugin = require('../..')(makeApp())
      const schema = plugin.schema()
      schema.properties.should.have.property('__fakeNogroupObj')
      schema.properties.should.have.property('__fakeNogroupObjParam')
      schema.properties.__fakeNogroupObjParam.default.should.equal(2)
    } finally {
      cleanup()
    }
  })

  it('skips a nogroup calc whose optionKey is absent from props on start()', () => {
    const cleanup = installFakeCalc({
      optionKey: '__fakeNogroupSkipped',
      title: 'Fake No-Group Skipped',
      derivedFrom: ['environment.outside.temperature'],
      calculator: () => null
    })
    try {
      const plugin = require('../..')(makeApp())
      // Props do NOT include '__fakeNogroupSkipped' -> hits the
      // `else if (!props[calculation.optionKey]) return` branch in
      // plugin.start without throwing.
      expect(() =>
        plugin.start({ traffic: { notificationZones: [] } })
      ).to.not.throw()
      plugin.stop()
    } finally {
      cleanup()
    }
  })

  it('honours an explicit calc.ttl override even when props.default_ttl is 0', (done) => {
    // Exercises the left arm of the `(calc.ttl > 0) || (props.default_ttl > 0)`
    // branch in plugin.start AND the `: calculation.ttl` arm of the
    // inner ternary that reads `calculation.ttl` when it is defined.
    // Real Bacon buses are required because plugin.start chains
    // `.skipDuplicates(skip_function)` only when a ttl is set, and we
    // need to push a duplicate through so skip_function actually runs.
    const cleanup = installFakeCalc(
      {
        optionKey: '__fakeNogroupTtl',
        title: 'Fake No-Group with explicit ttl',
        derivedFrom: ['environment.outside.temperature'],
        ttl: 1,
        calculator: (_t) => [
          { path: 'environment.outside.airDensity', value: 1 }
        ]
      },
      '__test_nogroup_ttl_calc'
    )
    const streams = {}
    const busApp = {
      selfId: 'self',
      streambundle: {
        getSelfStream: (p) => {
          if (!streams[p]) streams[p] = new Bacon.Bus()
          return streams[p]
        }
      },
      handleMessage: () => {},
      debug: () => {},
      error: () => {},
      setPluginStatus: () => {},
      setPluginError: () => {},
      getSelfPath: () => undefined,
      registerDeltaInputHandler: () => {},
      signalk: { self: 'vessels.self' }
    }
    const plugin = require('../..')(busApp)
    plugin.start({
      __fakeNogroupTtl: true,
      traffic: { notificationZones: [] }
    })

    // Push the same value twice so `.skipDuplicates(skip_function)`
    // actually runs skip_function and enters the `: calculation.ttl`
    // arm of the inner ternary.
    const stream = busApp.streambundle.getSelfStream(
      'environment.outside.temperature'
    )
    stream.push(290)
    setTimeout(() => {
      stream.push(290)
      setTimeout(() => {
        try {
          plugin.stop()
          done()
        } catch (e) {
          done(e)
        } finally {
          cleanup()
        }
      }, 50)
    }, 50)
  })
})
