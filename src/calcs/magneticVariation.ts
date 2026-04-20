import * as geomagnetism from 'geomagnetism'
import { isPosition } from '../utils'
import type { Calculation, CalculationFactory } from '../types'

// The WMM-2025 model is expensive to build (it loads spherical harmonic
// coefficients and constructs lookup tables). Position fixes arrive roughly
// once per second on a Raspberry Pi, so building the model once and
// reusing it for every call is a straight win — but the build must be
// deferred off the module-load path. geomagnetism.model() can throw
// (missing coefficients, corrupt install, future API break); if that
// throw escapes require() it takes out the plugin loader in
// src/index.ts and every other calc with it. Building lazily on first
// use and memoising a null on failure scopes the problem to this calc.
type GeoModel = ReturnType<typeof geomagnetism.model>
let model: GeoModel | null | undefined = undefined
let sourceName = 'WMM 2025'

function getModel(): GeoModel | null {
  if (model !== undefined) return model
  try {
    const m = geomagnetism.model()
    sourceName = (m.name || 'WMM-2025').replace('-', ' ')
    model = m
    return m
  } catch {
    model = null
    return null
  }
}

// Coarse cache: magnetic variation changes on the order of 0.01° per km, so
// caching by a ~0.1° (≈11 km) lat/lon cell keeps the result well within the
// tolerance of any consumer of this path, while cutting out model.point()
// entirely for the common case of a vessel sitting in one area. Single-entry
// because the hit rate is dominated by the "same cell as last fix" case;
// the miss path (cell crossing) is still just one model.point() call.
const CELL_SIZE_DEG = 0.1
let cachedLatCell: number | undefined
let cachedLonCell: number | undefined
let cachedMagVar: number | undefined

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'heading',
    optionKey: 'magneticVariation',
    title: 'Magnetic Variation',
    derivedFrom: ['navigation.position'],
    defaults: [undefined],
    // Magnetic variation changes on the km scale. Even a fast vessel (30 kn)
    // covers only ~150 m per second, so downstream consumers will not notice
    // a 10-second debounce, and it further cuts the emit path on the hot
    // position stream.
    debounceDelay: 10 * 1000,
    calculator: function (position: unknown) {
      if (!isPosition(position)) return
      const m = getModel()
      if (!m) return

      const latCell = Math.round(position.latitude / CELL_SIZE_DEG)
      const lonCell = Math.round(position.longitude / CELL_SIZE_DEG)

      let magVar: number
      if (latCell === cachedLatCell && lonCell === cachedLonCell) {
        magVar = cachedMagVar!
      } else {
        const info = m.point([position.latitude, position.longitude])
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

module.exports = factory
