// Integration tests for index.js — the plugin factory itself.
//
// These tests wire a fake SignalK app through require('../..'), which
// in turn loads every calc module and builds a schema. Because they
// span index.js + utils.js + every calc, they are integration tests
// rather than unit tests.

const chai = require('chai')
chai.Should()
const expect = chai.expect

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
