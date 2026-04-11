const _ = require('lodash')
const geomagnetism = require('geomagnetism')
const { isPosition } = require('../utils')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'magneticVariation',
    title: 'Magnetic Variation',
    derivedFrom: ['navigation.position'],
    defaults: [undefined, 9999],
    calculator: function (position) {
      if (!isPosition(position)) return

      const model = geomagnetism.model()
      const info = model.point([position.latitude, position.longitude])
      const magVar = (info.decl * Math.PI) / 180

      return [
        { path: 'navigation.magneticVariation', value: magVar },
        {
          path: 'navigation.magneticVariation.source',
          value: (model.name || 'WMM-2025').replace('-', ' ')
        }
      ]
    },
    tests: [
      {
        input: [{ latitude: 39.0631232, longitude: -76.4872768 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.1922,
            delta: 0.01
          }
        ]
      },
      {
        // Northern hemisphere, eastern longitude (Berlin)
        input: [{ latitude: 52.52, longitude: 13.405 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: 0.0892,
            delta: 0.01
          }
        ]
      },
      {
        // Southern hemisphere, eastern longitude (Sydney)
        input: [{ latitude: -33.8688, longitude: 151.2093 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: 0.2237,
            delta: 0.01
          }
        ]
      },
      {
        // North America mid-latitude (positive declination)
        input: [{ latitude: 35, longitude: -120 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: 0.2078,
            delta: 0.01
          }
        ]
      },
      {
        // Africa mid-latitude (negative declination)
        input: [{ latitude: -20, longitude: 30 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.2101,
            delta: 0.01
          }
        ]
      },
      {
        // Null position — calculator returns undefined
        input: [{ latitude: null, longitude: null }]
      },
      {
        input: [{ latitude: undefined, longitude: undefined }]
      },
      {
        input: [{ latitude: NaN, longitude: NaN }]
      },
      {
        input: [{ latitude: 100, longitude: 0 }]
      },
      {
        input: [{ latitude: 0, longitude: 0 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.0674,
            delta: 0.01
          }
        ]
      },
      {
        input: [{ latitude: 0, longitude: 10 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.0167,
            delta: 0.01
          }
        ]
      },
      {
        input: [{ latitude: 10, longitude: 0 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.0238,
            delta: 0.01
          }
        ]
      }
    ]
  }
}
