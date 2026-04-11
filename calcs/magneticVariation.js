const _ = require('lodash')
const geomagnetism = require('geomagnetism')
const { isPosition } = require('../utils')

// The WMM-2025 model is expensive to build (it loads spherical harmonic
// coefficients and constructs lookup tables). Position fixes arrive roughly
// once per second on a Raspberry Pi, so building the model once at module
// load and reusing it for every call is a straight win.
const model = geomagnetism.model()
const sourceName = (model.name || 'WMM-2025').replace('-', ' ')

// Coarse cache: magnetic variation changes on the order of 0.01° per km, so
// caching by a ~0.1° (≈11 km) lat/lon cell keeps the result well within the
// tolerance of any consumer of this path, while cutting out model.point()
// entirely for the common case of a vessel sitting in one area. Single-entry
// because the hit rate is dominated by the "same cell as last fix" case;
// the miss path (cell crossing) is still just one model.point() call.
const CELL_SIZE_DEG = 0.1
let cachedLatCell
let cachedLonCell
let cachedMagVar

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'magneticVariation',
    title: 'Magnetic Variation',
    derivedFrom: ['navigation.position'],
    defaults: [undefined, 9999],
    // Magnetic variation changes on the km scale. Even a fast vessel (30 kn)
    // covers only ~150 m per second, so downstream consumers will not notice
    // a 10-second debounce, and it further cuts the emit path on the hot
    // position stream.
    debounceDelay: 10 * 1000,
    calculator: function (position) {
      if (!isPosition(position)) return

      const latCell = Math.round(position.latitude / CELL_SIZE_DEG)
      const lonCell = Math.round(position.longitude / CELL_SIZE_DEG)

      let magVar
      if (latCell === cachedLatCell && lonCell === cachedLonCell) {
        magVar = cachedMagVar
      } else {
        const info = model.point([position.latitude, position.longitude])
        magVar = (info.decl * Math.PI) / 180
        cachedLatCell = latCell
        cachedLonCell = lonCell
        cachedMagVar = magVar
      }

      return [
        { path: 'navigation.magneticVariation', value: magVar },
        {
          path: 'navigation.magneticVariation.source',
          value: sourceName
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
