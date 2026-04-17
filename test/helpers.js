// Shared test helpers for the per-calc unit tests.
//
// makeApp/makePlugin reproduce the minimal shapes the plugin code reads
// from app.* and plugin.* at calculator call time. The defaults mirror
// what a freshly-configured SignalK server plus a mid-size boat would
// pass into the plugin, so tests only need to override the pieces they
// actually exercise.

const _ = require('lodash')

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

module.exports = { makeApp, makePlugin }
